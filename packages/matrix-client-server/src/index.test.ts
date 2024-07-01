import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from './index'
import { buildMatrixDb, buildUserDB } from './__testData__/buildUserDB'
import { type flowContent, type Config } from './types'
import defaultConfig from './__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { Hash, randomString } from '@twake/crypto'

process.env.TWAKE_CLIENT_SERVER_CONF = './src/__testData__/registerConf.json'
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
let validToken: string

const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  conf = {
    ...defaultConfig,
    cron_service: false,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    matrix_database_engine: 'sqlite'
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
  fs.unlinkSync('src/__testData__/test.db')
  fs.unlinkSync('src/__testData__/testMatrix.db')
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Error on server start', () => {
  process.env.HASHES_RATE_LIMIT = 'falsy_number'

  it('should display message error about hashes rate limit value', () => {
    expect(() => {
      clientServer = new ClientServer()
    }).toThrow(
      new Error(
        'hashes_rate_limit must be a number or a string representing a number'
      )
    )
    delete process.env.HASHES_RATE_LIMIT
  })
})

describe('Use configuration file', () => {
  beforeAll((done) => {
    clientServer = new ClientServer()
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
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  afterAll(() => {
    clientServer.cleanJobs()
  })

  test('Reject unimplemented endpoint with 404', async () => {
    const response = await request(app).get('/_matrix/unknown')
    expect(response.statusCode).toBe(404)
  })

  test('Reject bad method with 405', async () => {
    const response = await request(app).post(
      '/_matrix/client/v3/account/whoami'
    )
    expect(response.statusCode).toBe(405)
  })

  describe('/_matrix/client/v3/profile/{userId}', () => {
    describe('GET', () => {
      describe('/_matrix/client/v3/profile/{userId}', () => {
        const testUserId = '@testuser:example.com'

        beforeAll(async () => {
          clientServer.matrixDb
            .insert('profiles', {
              user_id: testUserId,
              displayname: 'Test User',
              avatar_url: 'http://example.com/avatar.jpg'
            })
            .then(() => {
              logger.info('Test user profile created')
            })
            .catch((e) => {
              logger.error('Error creating test user profile:', e)
            })
        })

        afterAll(async () => {
          clientServer.matrixDb
            .deleteEqual('profiles', 'user_id', testUserId)
            .then(() => {
              logger.info('Test user profile deleted')
            })
            .catch((e) => {
              logger.error('Error deleting test user profile:', e)
            })
        })

        it('should return the profile information for an existing user', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/profile/${testUserId}`
          )

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('avatar_url')
          expect(response.body).toHaveProperty('displayname')
        })

        // it('should return error 403 if the server is unwilling to disclose profile information', async () => {
        //   const response = await request(app).get(
        //     '/_matrix/client/v3/profile/@forbiddenuser:example.com'
        //   )

        //   expect(response.statusCode).toBe(403)
        //   expect(response.body.errcode).toBe('M_FORBIDDEN')
        //   expect(response.body).toHaveProperty('error')
        // })

        it('should return error 404 if the user does not exist', async () => {
          const response = await request(app).get(
            '/_matrix/client/v3/profile/@nonexistentuser:example.com'
          )

          expect(response.statusCode).toBe(404)
          expect(response.body.errcode).toBe('M_NOT_FOUND')
          expect(response.body).toHaveProperty('error')
        })
      })
    })
  })

  describe('Endpoints with authentication', () => {
    describe('/_matrix/client/v3/account/whoami', () => {
      it('should reject missing token (', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/account/whoami')
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })
      it('should reject token that mismatch regex', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/account/whoami')
          .set('Authorization', 'Bearer zzzzzzz')
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })
      it('should reject expired or invalid token', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/account/whoami')
          .set('Authorization', `Bearer ${randomString(64)}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })
      it('should accept valid token', async () => {
        validToken = randomString(64)
        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser:example.com',
          device_id: 'testdevice',
          access_token: validToken,
          ip: '127.0.0.1',
          user_agent: 'curl/7.31.0-DEV',
          last_seen: 1411996332123
        })
        await clientServer.matrixDb.insert('users', {
          name: '@testuser:example.com',
          password_hash: 'hashedpassword',
          creation_ts: Date.now(),
          admin: 0,
          upgrade_ts: 'null',
          is_guest: 0,
          appservice_id: 'null',
          consent_version: 'null',
          consent_server_notice_sent: 'null',
          user_type: 'null',
          deactivated: 0,
          shadow_banned: 0,
          consent_ts: 'null'
        })
        const response = await request(app)
          .get('/_matrix/client/v3/account/whoami')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
      })
    })

    describe('/_matrix/client/v3/admin/whois', () => {
      it('should refuse a request without a userId', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/admin/whois')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(400)
      })
      it('should send device information for the user being looked-up', async () => {
        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser:example.com',
          device_id: 'testdevice',
          access_token: validToken,
          ip: '10.0.0.2',
          user_agent:
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36',
          last_seen: 1411996332123
        })
        const response = await request(app)
          .get('/_matrix/client/v3/admin/whois')
          .query({ userId: '@testuser:example.com' })
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty('user_id', '@testuser:example.com')
        expect(response.body).toHaveProperty('devices')
        expect(response.body.devices).toHaveProperty('testdevice')
        expect(response.body.devices.testdevice).toHaveProperty('sessions')
        expect(response.body.devices.testdevice.sessions).toHaveLength(1)
        expect(response.body.devices.testdevice.sessions).toEqual([
          {
            connections: [
              {
                ip: '127.0.0.1',
                last_seen: 1411996332123,
                user_agent: 'curl/7.31.0-DEV'
              },
              {
                ip: '10.0.0.2',
                last_seen: 1411996332123,
                user_agent:
                  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36'
              }
            ]
          }
        ])
      })
      it('should work if the user has multiple devices and with multiple sessions', async () => {
        const validToken2 = randomString(64)
        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser:example.com',
          device_id: 'testdevice2',
          access_token: validToken2,
          ip: '127.0.0.1',
          last_seen: 1411996332123,
          user_agent: 'curl/7.31.0-DEV'
        })
        const response = await request(app)
          .get('/_matrix/client/v3/admin/whois')
          .query({ userId: '@testuser:example.com' })
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty('user_id', '@testuser:example.com')
        expect(response.body).toHaveProperty('devices')
        expect(response.body.devices).toHaveProperty('testdevice')
        expect(response.body.devices).toHaveProperty('testdevice2')
        expect(response.body.devices.testdevice2).toHaveProperty('sessions')
        expect(response.body.devices.testdevice2.sessions).toHaveLength(1)
        expect(response.body.devices.testdevice2.sessions).toEqual([
          {
            connections: [
              {
                ip: '127.0.0.1',
                last_seen: 1411996332123,
                user_agent: 'curl/7.31.0-DEV'
              }
            ]
          }
        ])
      })
    })
    describe('/_matrix/client/v3/register', () => {
      let flows: flowContent
      let session: string
      describe('User Interactive Authentication', () => {
        it('should validate user interactive authentication with a registration_token', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/register')
            .set('User-Agent', 'curl/7.31.0-DEV')
            .set('X-Forwarded-For', '203.0.113.195')
            .query({ kind: 'user' })
            .send({}) // empty request to get authentication types
          flows = response.body.flows
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
              auth: { type: flows[3].stages[0], token: validToken, session }
            })
          expect(response2.statusCode).toBe(401)
          expect(response2.body).toHaveProperty('flows')
          expect(response2.body).toHaveProperty('session')
          expect(response2.body).toHaveProperty('completed')
          expect(response2.body.completed).toEqual([flows[3].stages[0]])
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
                type: flows[3].stages[0],
                token: 'exampleToken',
                session: randomString(20)
              }
            })
          expect(response.statusCode).toBe(401)
          expect(response.body).toHaveProperty('error')
          expect(response.body).toHaveProperty('errcode')
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
        flows = response.body.flows
        session = response.body.session
      })
      it('should run the register endpoint after authentication was completed', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({
            auth: { type: flows[0].stages[0], session },
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
            auth: { type: flows[0].stages[0], session: randomString(20) },
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
    })
  })
})
