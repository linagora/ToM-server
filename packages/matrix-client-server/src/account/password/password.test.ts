import fs from 'fs'
import express from 'express'
import request from 'supertest'
import ClientServer from '../../index'
import { buildMatrixDb, buildUserDB } from '../../__testData__/buildUserDB'
import { type Config } from '../../types'
import defaultConfig from '../../__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { setupTokens, validToken } from '../../__testData__/setupTokens'
import { Hash, randomString } from '@twake/crypto'
import { epoch } from '@twake/utils'

jest.mock('node-fetch', () => jest.fn())

let conf: Config
let clientServer: ClientServer
let app: express.Application

const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  // @ts-expect-error TS doesn't understand that the config is valid
  conf = {
    ...defaultConfig,
    cron_service: false,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    matrix_database_engine: 'sqlite',
    matrix_database_host: './src/__testData__/testMatrixPassword.db',
    database_host: './src/__testData__/testPassword.db',
    userdb_host: './src/__testData__/testPassword.db'
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
  fs.unlinkSync('src/__testData__/testPassword.db')
  fs.unlinkSync('src/__testData__/testMatrixPassword.db')
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

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mock('node-fetch', () => jest.fn())
  })

  describe('Endpoints with authentication', () => {
    beforeAll(async () => {
      await setupTokens(clientServer, logger)
    })
    describe('/_matrix/client/v3/account/password', () => {
      let session: string
      it('should refuse an invalid logout_devices', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/password')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            logout_devices: 'true'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid logout_devices')
      })
      it('should refuse an invalid new_password', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/password')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            new_password: 55
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid new_password')
      })
      it('should refuse an invalid auth', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/password')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            auth: { type: 'wrongtype' }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid auth')
      })
      it('should return 403 if the user is not an admin and the server does not allow it', async () => {
        clientServer.conf.capabilities.enable_change_password = false
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/password')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: 'sid',
            client_secret: 'my'
          })
        expect(response1.statusCode).toBe(401)
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/account/password')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            new_password: 'newpassword',
            auth: {
              type: 'm.login.password',
              session,
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              identifier: { type: 'm.id.user', user: '@testuser:example.com' }
            }
          })
        expect(response.statusCode).toBe(403)
        expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
        expect(response.body).toHaveProperty(
          'error',
          'Cannot change password as it is not allowed by server'
        )
        delete clientServer.conf.capabilities.enable_change_password
      })
      it('should change password of the user', async () => {
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/password')
          .set('Accept', 'application/json')
          .send({
            sid: 'sid',
            client_secret: 'my'
          })
        expect(response1.statusCode).toBe(401)
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/account/password')
          .set('Accept', 'application/json')
          .send({
            new_password: 'newpassword',
            auth: {
              type: 'm.login.password',
              session,
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              identifier: { type: 'm.id.user', user: '@testuser:example.com' }
            }
          })
        expect(response.statusCode).toBe(200)

        const hash = new Hash()
        await hash.ready
        const hashedPassword = hash.sha256('newpassword')
        const updatedPassword = (
          await clientServer.matrixDb.get('users', ['password_hash'], {
            name: '@testuser:example.com'
          })
        )[0].password_hash
        expect(updatedPassword).toBe(hashedPassword)
      })
      it('should delete all devices and tokens except the current one if logout_devices is set to true', async () => {
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/password')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: 'sid',
            client_secret: 'my'
          })
        expect(response1.statusCode).toBe(401)
        session = response1.body.session

        await clientServer.matrixDb.insert('devices', {
          user_id: '@testuser:example.com',
          device_id: 'testdevice'
        }) // device to keep
        await clientServer.matrixDb.insert('devices', {
          user_id: '@testuser:example.com',
          device_id: 'deviceToDelete'
        })
        await clientServer.matrixDb.insert('access_tokens', {
          id: randomString(64),
          user_id: '@testuser:example.com',
          device_id: 'testdevice',
          token: 'tokenToDelete',
          valid_until_ms: epoch() + 64000
        })
        const response = await request(app)
          .post('/_matrix/client/v3/account/password')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            new_password: 'newpassword2',
            auth: {
              type: 'm.login.password',
              session,
              password: 'newpassword',
              identifier: { type: 'm.id.user', user: '@testuser:example.com' }
            },
            logout_devices: true
          })
        expect(response.statusCode).toBe(200)
        const devices = await clientServer.matrixDb.get(
          'devices',
          ['device_id'],
          {
            user_id: '@testuser:example.com'
          }
        )
        expect(devices).toHaveLength(1)
        expect(devices[0].device_id).toBe('testdevice')
        const tokens = await clientServer.matrixDb.get(
          'access_tokens',
          ['token'],
          {
            user_id: '@testuser:example.com'
          }
        )
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token).toBe(validToken)
      })
    })
  })
})
