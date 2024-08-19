import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../index'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import { type Config } from '../types'
import defaultConfig from '../__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import {
  setupTokens,
  validToken,
  validToken2
} from '../__testData__/setupTokens'
jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

let conf: Config
let clientServer: ClientServer
let app: express.Application

const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  // @ts-expect-error TS doesn't understand that the config is valid
  conf = {
    ...defaultConfig,
    base_url: 'http://example.com/',
    matrix_database_host: 'src/__testData__/userTestMatrix.db',
    userdb_host: 'src/__testData__/userTest.db',
    database_host: 'src/__testData__/userTest.db',
    registration_required_3pid: ['email', 'msisdn']
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
  fs.unlinkSync('src/__testData__/userTest.db')
  fs.unlinkSync('src/__testData__/userTestMatrix.db')
})

beforeEach(() => {
  jest.clearAllMocks()
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

    describe('/_matrix/client/v3/user/:userId', () => {
      describe('/_matrix/client/v3/user/:userId/account_data/:type', () => {
        describe('GET', () => {
          it('should reject invalid userId', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/invalidUserId/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject invalid roomId', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/invalidRoomId/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject an invalid event type', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/invalidEventType'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject missing account data', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(404)
            expect(response.body).toHaveProperty('errcode', 'M_NOT_FOUND')
          })
          it('should refuse to return account data for another user', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@anotheruser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should return account data', async () => {
            await clientServer.matrixDb.insert('account_data', {
              user_id: '@testuser:example.com',
              account_data_type: 'm.room.message',
              stream_id: 1,
              content: 'test content'
            })
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(200)
            expect(response.body['m.room.message']).toBe('test content')
          })
        })
        describe('PUT', () => {
          it('should reject invalid userId', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/invalidUserId/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject an invalid event type', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/invalidEventType'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject event types managed by the server', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.push_rules'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content: 'new content' })
            expect(response.statusCode).toBe(405)
            expect(response.body).toHaveProperty('errcode', 'M_BAD_JSON')
            const response2 = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.fully_read'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content: 'new content' })
            expect(response2.statusCode).toBe(405)
            expect(response2.body).toHaveProperty('errcode', 'M_BAD_JSON')
          })
          it('should reject missing account data', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_UNKNOWN') // Error code from jsonContent function of @twake/utils
          })
          it('should refuse to update account data for another user', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@anotheruser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content: 'new content' })
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should update account data', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content: 'updated content' })
            expect(response.statusCode).toBe(200)
            const response2 = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response2.statusCode).toBe(200)
            expect(response2.body['m.room.message']).toBe('updated content')
          })
        })
      })

      describe('/_matrix/client/v3/user/:userId/rooms/:roomId/account_data/:type', () => {
        describe('GET', () => {
          it('should reject invalid userId', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/invalidUserId/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject invalid roomId', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/invalidRoomId/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject an invalid event type', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/invalidEventType'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject missing account data', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(404)
            expect(response.body).toHaveProperty('errcode', 'M_NOT_FOUND')
          })
          it('should refuse to return account data for another user', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@anotheruser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should return account data', async () => {
            await clientServer.matrixDb.insert('room_account_data', {
              user_id: '@testuser:example.com',
              account_data_type: 'm.room.message',
              stream_id: 1,
              content: 'test content',
              room_id: '!roomId:example.com'
            })
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(200)
            expect(response.body['m.room.message']).toBe('test content')
          })
        })
        describe('PUT', () => {
          it('should reject invalid userId', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/invalidUserId/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject invalid roomId', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/invalidRoomId/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject an invalid event type', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/invalidEventType'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject event types managed by the server', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.push_rules'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content: 'new content' })
            expect(response.statusCode).toBe(405)
            expect(response.body).toHaveProperty('errcode', 'M_BAD_JSON')
            const response2 = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.fully_read'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content: 'new content' })
            expect(response2.statusCode).toBe(405)
            expect(response2.body).toHaveProperty('errcode', 'M_BAD_JSON')
          })
          it('should reject missing account data', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_UNKNOWN') // Error code from jsonContent function of @twake/utils
          })
          it('should refuse to update account data for another user', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@anotheruser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content: 'new content' })
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should update account data', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content: 'updated content' })
            expect(response.statusCode).toBe(200)
            const response2 = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response2.statusCode).toBe(200)
            expect(response2.body['m.room.message']).toBe('updated content')
          })
        })
      })
    })
    describe('/_matrix/client/v3/user/:userId/openid/request_token', () => {
      it('should reject invalid userId', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/user/invalidUserId/openid/request_token')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      })
      it('should reject a userId that does not match the token', async () => {
        const response = await request(app)
          .post(
            '/_matrix/client/v3/user/@testuser:example.com/openid/request_token'
          )
          .set('Authorization', `Bearer ${validToken2}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(403)
        expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
      })
      it('should return a token on a valid attempt', async () => {
        const response = await request(app)
          .post(
            '/_matrix/client/v3/user/@testuser:example.com/openid/request_token'
          )
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty('access_token')
        expect(response.body).toHaveProperty('expires_in')
        expect(response.body).toHaveProperty('matrix_server_name')
        expect(response.body).toHaveProperty('token_type')
      })
    })
  })
  describe('/_matrix/client/v3/register', () => {
    let session: string
    it('should validate UIAuth with msisdn and email verification', async () => {
      const response1 = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          username: 'new_user',
          device_id: 'device_Id',
          inhibit_login: true,
          initial_device_display_name: 'testdevice'
        })
      expect(response1.statusCode).toBe(401)
      expect(response1.body).toHaveProperty('session')
      session = response1.body.session
      const response2 = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          username: 'new_user',
          device_id: 'device_Id',
          inhibit_login: true,
          initial_device_display_name: 'testdevice',
          auth: {
            type: 'm.login.msisdn',
            session,
            threepid_creds: {
              sid: 'validatedSession',
              client_secret: 'validatedSecret'
            }
          }
        })
      expect(response2.statusCode).toBe(401)
      expect(response2.body).toHaveProperty('completed')
      expect(response2.body.completed).toEqual(['m.login.msisdn'])
      const response3 = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          username: 'new_user',
          device_id: 'device_Id',
          inhibit_login: true,
          initial_device_display_name: 'testdevice',
          auth: {
            type: 'm.login.email.identity',
            session,
            threepid_creds: {
              sid: 'validatedSession2',
              client_secret: 'validatedSecret2'
            }
          }
        })
      expect(response3.statusCode).toBe(200)
    })
  })
})
