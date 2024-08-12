import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../index'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import { type Config } from '../types'
import defaultConfig from '../__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { setupTokens, validToken } from '../__testData__/setupTokens'

jest.mock('node-fetch', () => jest.fn())

let conf: Config
let clientServer: ClientServer
let app: express.Application

const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  // @ts-expect-error TS doesn't understand that the config is valid
  conf = {
    ...defaultConfig,
    base_url: 'http://example.com/',
    matrix_database_host: './src/__testData__/testMatrixPresence.db',
    userdb_host: './src/__testData__/testPresence.db',
    database_host: './src/__testData__/testPresence.db',
    is_registration_enabled: false
  }
  if (process.env.TEST_PG === 'yes') {
    conf.database_engine = 'pg'
    conf.userdb_engine = 'pg'
    conf.database_host = process.env.PG_HOST ?? 'localhost'
    conf.database_user = process.env.PG_USER ?? 'twake'
    conf.database_password = process.env.PG_PASSWORD ?? 'twake'
    conf.database_name = process.env.PG_DATABASE ?? 'test'
  }
  buildUserDB(conf)
    .then(() => {
      buildMatrixDb(conf)
        .then(() => {
          done()
        })
        .catch((e) => {
          logger.error('Error while building matrix db:', e)
          done(e)
        })
    })
    .catch((e) => {
      logger.error('Error while building user db:', e)
      done(e)
    })
})

afterAll(() => {
  fs.unlinkSync('src/__testData__/testPresence.db')
  fs.unlinkSync('src/__testData__/testMatrixPresence.db')
})

describe('Use configuration file', () => {
  beforeAll((done) => {
    clientServer = new ClientServer(conf)
    app = express()
    clientServer.ready
      .then(() => {
        Object.keys(clientServer.api.get).forEach((k) => {
          app.get(k, clientServer.api.get[k])
        })
        Object.keys(clientServer.api.post).forEach((k) => {
          app.post(k, clientServer.api.post[k])
        })
        Object.keys(clientServer.api.put).forEach((k) => {
          app.put(k, clientServer.api.put[k])
        })
        Object.keys(clientServer.api.delete).forEach((k) => {
          app.delete(k, clientServer.api.delete[k])
        })
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  afterAll(() => {
    clientServer.cleanJobs()
  })

  describe('Endpoints with authentication', () => {
    beforeAll(async () => {
      await setupTokens(clientServer, logger)
    })
    describe('/_matrix/client/v3/presence/:userId/status', () => {
      describe('GET', () => {
        it('should return the presence state of a user', async () => {
          await clientServer.matrixDb.insert('presence', {
            user_id: '@testuser:example.com',
            state: 'online',
            status_msg: 'I am online',
            mtime: Date.now()
          })
          const response = await request(app)
            .get('/_matrix/client/v3/presence/@testuser:example.com/status')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('currently_active', true)
          expect(response.body).toHaveProperty('last_active_ts')
          expect(response.body).toHaveProperty('state', 'online')
          expect(response.body).toHaveProperty('status_msg', 'I am online')
        })
        it('should reject a request made to an uknown user', async () => {
          const response = await request(app)
            .get('/_matrix/client/v3/presence/@unknownuser:example.com/status')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(404)
        })
        it('should reject a request with a userId that does not match the regex', async () => {
          const response = await request(app)
            .get('/_matrix/client/v3/presence/invalidUserId/status')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
        })
      })
      describe('PUT', () => {
        it('should set the presence state of a user', async () => {
          const response = await request(app)
            .put('/_matrix/client/v3/presence/@testuser:example.com/status')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({ presence: 'offline', status_msg: 'I am offline' })
          expect(response.statusCode).toBe(200)
          const presence = await clientServer.matrixDb.get(
            'presence',
            ['state', 'status_msg'],
            { user_id: '@testuser:example.com' }
          )
          expect(presence).toHaveLength(1)
          expect(presence[0].state).toBe('offline')
          expect(presence[0].status_msg).toBe('I am offline')
        })
        it('should reject a request to set the presence state of another user', async () => {
          const response = await request(app)
            .put('/_matrix/client/v3/presence/@anotheruser:example.com/status')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({ presence: 'offline', status_msg: 'I am offline' })
          expect(response.statusCode).toBe(403)
        })
        it('should reject a state that wants to set a wrong presence status', async () => {
          const response = await request(app)
            .put('/_matrix/client/v3/presence/@testuser:example.com/status')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({ presence: 'wrongStatus', status_msg: 'I am offline' })
          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty(
            'error',
            'Invalid presence state'
          )
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        })
        it('should reject a state that wants to set a status message that is too long', async () => {
          let statusMsg = ''
          for (let i = 0; i < 2050; i++) {
            statusMsg += 'a'
          }
          const response = await request(app)
            .put('/_matrix/client/v3/presence/@testuser:example.com/status')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({ presence: 'online', status_msg: statusMsg })
          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty(
            'error',
            'Status message is too long'
          )
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        })
        it('should reject a request with a userId that does not match the regex', async () => {
          const response = await request(app)
            .put('/_matrix/client/v3/presence/invalidUserId/status')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
        })
      })
    })
    describe('/_matrix/client/v3/register', () => {
      // Test put here since presence doesn't need registration so we can modify the config without consequence
      it('should return 404 if registration is disabled', async () => {
        const response = await request(app).post('/_matrix/client/v3/register')
        expect(response.statusCode).toBe(404)
      })
    })
  })
})
