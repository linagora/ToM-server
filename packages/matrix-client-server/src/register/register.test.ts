import { getLogger, type TwakeLogger } from '@twake/logger'
import ClientServer from '../index'
import { type Config } from '../types'
import express from 'express'
import defaultConfig from '../__testData__/registerConf.json'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import fs from 'fs'
import { Hash, randomString } from '@twake/crypto'
import request from 'supertest'
import { setupTokens, validToken } from '../utils/setupTokens'

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
    matrix_database_host: 'testMatrixRegister.db',
    database_host: 'testRegister.db',
    userdb_host: 'testRegister.db'
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
  fs.unlinkSync('testRegister.db')
  fs.unlinkSync('testMatrixRegister.db')
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
  describe('/_matrix/client/v3/register', () => {
    let session: string
    beforeAll(async () => {
      await setupTokens(clientServer, logger)
    })
    describe('User Interactive Authentication', () => {
      it('should validate user interactive authentication with a registration_token', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({}) // empty request to get authentication types
        session = response.body.session
        await clientServer.matrixDb.insert('registration_tokens', {
          token: validToken,
          uses_allowed: 100,
          pending: 0,
          completed: 0
        })
        const response2 = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.registration_token',
              token: validToken,
              session
            }
          })
        expect(response2.statusCode).toBe(200)
        expect(response2.body).toHaveProperty('user_id')
        expect(response2.body).toHaveProperty('access_token')
        expect(response2.body).toHaveProperty('device_id')
      })
      it('should invalidate a registration_token after it has been used too many times for user-interactive-authentication', async () => {
        await clientServer.matrixDb.insert('registration_tokens', {
          token: 'exampleToken',
          uses_allowed: 10,
          pending: 8,
          completed: 4
        })
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.registration_token',
              token: 'exampleToken',
              session: randomString(20)
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('error')
        expect(response.body).toHaveProperty('errcode')
      })
      it('should refuse autenticating an appservice without a token', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.application_service',
              username: '_irc_bridge_'
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('error')
        expect(response.body).toHaveProperty('errcode', 'M_MISSING_TOKEN')
      })
      it('should refuse authenticating an appservice with the wrong token', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('Authorization', `Bearer wrongToken`)
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.application_service',
              username: '_irc_bridge_'
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('error')
        expect(response.body).toHaveProperty('errcode', 'M_UNKNOWN_TOKEN')
      })
      it('should refuse authenticating an appservice with a username that is too long', async () => {
        const asToken = conf.application_services[0].as_token
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('Authorization', `Bearer ${asToken}`)
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.application_service',
              username: 'invalidUser'
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('error')
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_USERNAME')
      })
      it('should refuse authenticating an appservice with a username it has not registered', async () => {
        const asToken = conf.application_services[0].as_token
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('Authorization', `Bearer ${asToken}`)
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.application_service',
              username: 'user'
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('error')
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_USERNAME')
      })
      it('should validate an authentication after the user has accepted the terms', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.terms',
              session: randomString(20)
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('flows')
        expect(response.body).toHaveProperty('session')
        expect(response.body).toHaveProperty('completed')
        expect(response.body.completed).toEqual(['m.login.terms'])
      })
      it('should refuse an authentication with an incorrect password', async () => {
        const hash = new Hash()
        await hash.ready
        await clientServer.matrixDb.insert('users', {
          name: '@abba:example.com',
          password_hash: hash.sha256('password')
        })
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.password',
              identifier: { type: 'm.id.user', user: '@abba:example.com' },
              password: 'wrongpassword',
              session: randomString(20)
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('error')
        expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
      })
      it('should refuse an authentication with the pasword of another user', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.password',
              identifier: {
                type: 'm.id.user',
                user: '@otheruser:example.com'
              },
              password: 'password',
              session: randomString(20)
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('error')
        expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
      })
      it('should accept an authentication with a correct password', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.password',
              identifier: { type: 'm.id.user', user: '@abba:example.com' },
              password: 'password',
              session: randomString(20)
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('completed')
        expect(response.body.completed).toEqual(['m.login.password'])
      })
    })
    it('should send the flows for userInteractiveAuthentication', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({}) // Request without auth parameter so that the server sends the authentication flows
      expect(response.statusCode).toBe(401)
      expect(response.body).toHaveProperty('flows')
      expect(response.body).toHaveProperty('session')
      session = response.body.session
    })
    it('should run the register endpoint after authentication was completed', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          auth: { type: 'm.login.dummy', session },
          username: 'newuser',
          device_id: 'deviceId',
          inhibit_login: false,
          initial_device_display_name: 'testdevice'
        })
      expect(response.statusCode).toBe(200)
      expect(response.body).toHaveProperty('user_id')
      expect(response.body).toHaveProperty('expires_in_ms')
      expect(response.body).toHaveProperty('access_token')
      expect(response.body).toHaveProperty('device_id')
    })
    it('should only return the userId when inhibit login is set to true', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          auth: { type: 'm.login.dummy', session: randomString(20) },
          username: 'new_user',
          device_id: 'device_Id',
          inhibit_login: true,
          initial_device_display_name: 'testdevice'
        })
      expect(response.statusCode).toBe(200)
      expect(response.body).toHaveProperty('user_id')
      expect(response.body).not.toHaveProperty('expires_in_ms')
      expect(response.body).not.toHaveProperty('access_token')
      expect(response.body).not.toHaveProperty('device_id')
    })
    it('should refuse an incorrect username', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          auth: {
            type: 'm.login.dummy',
            session: randomString(20)
          },
          username: '@localhost:example.com'
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_USERNAME')
    })
    it('should accept guest registration', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'guest' })
        .send({})
      expect(response.statusCode).toBe(200)
      expect(response.body).toHaveProperty('user_id')
      expect(response.body).toHaveProperty('expires_in_ms')
      expect(response.body).toHaveProperty('access_token')
      expect(response.body).toHaveProperty('device_id')
    })
    it('should accept guest registration with inhibit_login set to true', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'guest' })
        .send({ inhibit_login: true })
      expect(response.statusCode).toBe(200)
      expect(response.body).toHaveProperty('user_id')
      expect(response.body).not.toHaveProperty('expires_in_ms')
      expect(response.body).not.toHaveProperty('access_token')
      expect(response.body).not.toHaveProperty('device_id')
    })
    it('should refuse a username that is already in use', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          username: 'newuser',
          auth: { type: 'm.login.dummy', session: randomString(20) }
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('errcode', 'M_USER_IN_USE')
    })
    // The following test might be necessary but spec is unclear so it is commented out for now

    // it('should refuse a request without User Agent', async () => {
    //   const response = await request(app)
    //     .post('/_matrix/client/v3/register')
    //     .set('X-Forwarded-For', '203.0.113.195')
    //     .query({ kind: 'user' })
    //     .send({
    //       username: 'newuser',
    //       auth: { type: 'm.login.dummy', session: randomString(20) }
    //     })
    //   expect(response.statusCode).toBe(400)
    //   expect(response.body).toHaveProperty('error')
    //   expect(response.body).toHaveProperty('errcode', 'M_MISSING_PARAMS')
    // })
  })
  describe('/_matrix/client/v3/register/available', () => {
    it('should refuse an invalid username', async () => {
      const response = await request(app)
        .get('/_matrix/client/v3/register/available')
        .query({ username: 'invalidUsername' })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
    })
    it('should refuse a username that is in an exclusive namespace', async () => {
      const response = await request(app)
        .get('/_matrix/client/v3/register/available')
        .query({ username: '@_irc_bridge_:example.com' })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('errcode', 'M_EXCLUSIVE')
    })
    it('should refuse a username that is already in use', async () => {
      const response = await request(app)
        .get('/_matrix/client/v3/register/available')
        .query({ username: '@newuser:example.com' }) // registered in a previous test
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('errcode', 'M_USER_IN_USE')
    })
    it('should accept a username that is available', async () => {
      const response = await request(app)
        .get('/_matrix/client/v3/register/available')
        .query({ username: '@newuser2:example.com' })
      expect(response.statusCode).toBe(200)
      expect(response.body).toHaveProperty('available', true)
    })
  })
})
