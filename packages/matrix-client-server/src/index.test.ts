import fs from 'fs'
import request, { type Response } from 'supertest'
import express from 'express'
import ClientServer from './index'
import { buildMatrixDb, buildUserDB } from './__testData__/buildUserDB'
import { type Config } from './types'
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

const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  // @ts-expect-error TS doesn't understand that the config is valid
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

  it('should return true if provided user is hosted on local server', async () => {
    expect(clientServer.isMine('@testuser:example.com')).toBe(true)
  })

  it('should return false if provided user is hosted on remote server', async () => {
    expect(clientServer.isMine('@testuser:remote.com')).toBe(false)
  })

  describe('/_matrix/client/v3/profile/:userId', () => {
    describe('GET', () => {
      const testUserId = '@testuser:example.com'
      const incompleteUserId = '@incompleteuser:example.com'

      beforeAll(async () => {
        try {
          await clientServer.matrixDb.insert('profiles', {
            user_id: testUserId,
            displayname: 'Test User',
            avatar_url: 'http://example.com/avatar.jpg'
          })
          logger.info('Test user profile created')

          await clientServer.matrixDb.insert('profiles', {
            user_id: incompleteUserId
          })
          logger.info('Incomplete test user profile created')
        } catch (e) {
          logger.error('Error creating profiles:', e)
        }
      })

      afterAll(async () => {
        try {
          await clientServer.matrixDb.deleteEqual(
            'profiles',
            'user_id',
            testUserId
          )
          logger.info('Test user profile deleted')

          await clientServer.matrixDb.deleteEqual(
            'profiles',
            'user_id',
            incompleteUserId
          )
          logger.info('Incomplete test user profile deleted')
        } catch (e) {
          logger.error('Error deleting profiles:', e)
        }
      })

      describe('/_matrix/client/v3/profile/:userId', () => {
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

      describe('/_matrix/client/v3/profile/:userId/avatar_url', () => {
        it('should return the avatar_url for an existing user', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/profile/${testUserId}/avatar_url`
          )

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('avatar_url')
        })

        it('should return error 404 if the user does not exist', async () => {
          const response = await request(app).get(
            '/_matrix/client/v3/profile/@nonexistentuser:example.com/avatar_url'
          )
          expect(response.statusCode).toBe(404)
          expect(response.body.errcode).toBe('M_NOT_FOUND')
          expect(response.body).toHaveProperty('error')
        })

        it('should return error 404 if the user does not have an existing avatar_url', async () => {
          const response = await request(app).get(
            '/_matrix/client/v3/profile/@incompleteuser:example.com/avatar_url'
          )
          expect(response.statusCode).toBe(404)
          expect(response.body.errcode).toBe('M_NOT_FOUND')
          expect(response.body).toHaveProperty('error')
        })
      })

      describe('/_matrix/client/v3/profile/:userId/displayname', () => {
        it('should return the displayname for an existing user', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/profile/${testUserId}/displayname`
          )

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('displayname')
        })

        it('should return error 404 if the user does not exist', async () => {
          const response = await request(app).get(
            '/_matrix/client/v3/profile/@nonexistentuser:example.com/displayname'
          )

          expect(response.statusCode).toBe(404)
          expect(response.body.errcode).toBe('M_NOT_FOUND')
          expect(response.body).toHaveProperty('error')
        })

        it('should return error 404 if the user does not have an existing avatar_url', async () => {
          const response = await request(app).get(
            '/_matrix/client/v3/profile/@incompleteuser:example.com/displayname'
          )

          expect(response.statusCode).toBe(404)
          expect(response.body.errcode).toBe('M_NOT_FOUND')
          expect(response.body).toHaveProperty('error')
        })
      })
    })
  })

  let validToken: string
  let validToken2: string
  let validToken3: string
  describe('Endpoints with authentication', () => {
    beforeAll(async () => {
      validToken = randomString(64)
      validToken2 = randomString(64)
      validToken3 = randomString(64)
      try {
        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser:example.com',
          device_id: 'testdevice',
          access_token: validToken,
          ip: '127.0.0.1',
          user_agent: 'curl/7.31.0-DEV',
          last_seen: 1411996332123
        })

        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser2:example.com',
          device_id: 'testdevice2',
          access_token: validToken2,
          ip: '137.0.0.1',
          user_agent: 'curl/7.31.0-DEV',
          last_seen: 1411996332123
        })

        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser3:example.com',
          device_id: 'testdevice3',
          access_token: validToken3,
          ip: '147.0.0.1',
          user_agent: 'curl/7.31.0-DEV',
          last_seen: 1411996332123
        })
      } catch (e) {
        logger.error('Error creating tokens for authentification', e)
      }
    })
    describe('/_matrix/client/v3/account/whoami', () => {
      let asToken: string
      it('should reject if more than 100 requests are done in less than 10 seconds', async () => {
        let token
        let response
        // eslint-disable-next-line @typescript-eslint/no-for-in-array, @typescript-eslint/no-unused-vars
        for (const i in [...Array(101).keys()]) {
          token = Number(i) % 2 === 0 ? `Bearer ${validToken}` : 'falsy_token'
          response = await request(app)
            .get('/_matrix/client/v3/account/whoami')
            .set('Authorization', token)
            .set('Accept', 'application/json')
        }
        expect((response as Response).statusCode).toEqual(429)
        await new Promise((resolve) => setTimeout(resolve, 11000))
      })
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
      it('should accept a valid appservice authentication', async () => {
        asToken = conf.application_services[0].as_token
        const registerResponse = await request(app)
          .post('/_matrix/client/v3/register')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.application_service',
              username: '_irc_bridge_'
            },
            username: '_irc_bridge_'
          })
          .set('Authorization', `Bearer ${asToken}`)
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '127.10.00')
          .set('Accept', 'application/json')
        expect(registerResponse.statusCode).toBe(200)
        const response = await request(app)
          .get('/_matrix/client/v3/account/whoami')
          .query({ user_id: '@_irc_bridge_:example.com' })
          .set('Authorization', `Bearer ${asToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body.user_id).toBe('@_irc_bridge_:example.com')
      })
      it('should refuse an appservice authentication with a user_id not registered in the appservice', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/account/whoami')
          .query({ user_id: '@testuser:example.com' })
          .set('Authorization', `Bearer ${asToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(403)
      })
      it('should ensure a normal user cannot access the account of an appservice', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/account/whoami')
          .query({ user_id: '@_irc_bridge_:example.com' })
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.body).toHaveProperty('user_id', '@testuser:example.com') // not _irc_bridge_ (appservice account)
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
        const validTokenbis = randomString(64)
        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser:example.com',
          device_id: 'testdevice2',
          access_token: validTokenbis,
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
      let session: string
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

    describe('/_matrix/client/v3/user/:userId', () => {
      describe('/_matrix/client/v3/user/:userId/account_data/:type', () => {
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

    describe('/_matrix/client/v3/profile/:userId', () => {
      describe('PUT', () => {
        const testUserId = '@testuser:example.com'
        beforeAll(async () => {
          try {
            await clientServer.matrixDb.insert('users', {
              name: '@testuser2:example.com',
              admin: 1
            })
            await clientServer.matrixDb.insert('users', {
              name: '@testuser3:example.com',
              admin: 0
            })
            await clientServer.matrixDb.insert('profiles', {
              user_id: testUserId,
              displayname: 'Test User',
              avatar_url: 'http://example.com/avatar.jpg'
            })
            logger.info('Test user profile created')
          } catch (e) {
            logger.error('Error creating test user profile:', e)
          }
        })

        afterAll(async () => {
          try {
            await clientServer.matrixDb.deleteEqual(
              'users',
              'name',
              '@testuser2:example.com'
            )
            await clientServer.matrixDb.deleteEqual(
              'users',
              'name',
              '@testuser3:example.com'
            )
            await clientServer.matrixDb.deleteEqual(
              'profiles',
              'user_id',
              testUserId
            )
            logger.info('Test user profile deleted')
          } catch (e) {
            logger.error('Error deleting test user profile:', e)
          }
        })

        describe('/_matrix/client/v3/profile/:userId/avatar_url', () => {
          it('should require authentication', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', 'Bearer invalidToken')
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(401)
          })

          it('should return 400 if the target user is on a remote server', async () => {
            const response = await request(app)
              .put(
                `/_matrix/client/v3/profile/@testuser:anotherexample.com/avatar_url`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })
            expect(response.statusCode).toBe(400)
          })

          it('should return 403 if the requester is not admin and is not the target user', async () => {
            const response = await request(app)
              .put(
                `/_matrix/client/v3/profile/@testuser2:example.com/avatar_url`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })
            expect(response.statusCode).toBe(403)
          })

          it('should return 400 if provided avatar_url is too long', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ avatar_url: randomString(2049) })
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })

          it('should send correct response when requester is admin and target user is on local server', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', `Bearer ${validToken2}`)
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })

            expect(response.statusCode).toBe(200)
            expect(response.body).toEqual({})
          })

          it('should send correct response when requester is target user (on local server)', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })

            expect(response.statusCode).toBe(200)
            expect(response.body).toEqual({})
          })

          it('should correctly update the avatar_url of an existing user', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })
            expect(response.statusCode).toBe(200)
            const rows = await clientServer.matrixDb.get(
              'profiles',
              ['avatar_url'],
              { user_id: testUserId }
            )

            expect(rows.length).toBe(1)
            expect(rows[0].avatar_url).toBe('http://example.com/new_avatar.jpg')
          })
        })

        describe('/_matrix/client/v3/profile/{userId}/displayname', () => {
          it('should require authentication', async () => {
            await clientServer.cronTasks?.ready
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
              .set('Authorization', 'Bearer invalidToken')
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(401)
          })

          it('should return 400 if the target user is on a remote server', async () => {
            const response = await request(app)
              .put(
                `/_matrix/client/v3/profile/@testuser:anotherexample.com/displayname`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ displayname: 'New name' })
            expect(response.statusCode).toBe(400)
          })

          it('should return 403 if the requester is not admin and is not the target user', async () => {
            const response = await request(app)
              .put(
                `/_matrix/client/v3/profile/@testuser2:example.com/displayname`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ displayname: 'New name' })
            expect(response.statusCode).toBe(403)
          })

          it('should return 400 if provided display_name is too long', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ displayname: randomString(257) })
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })

          it('should send correct response when requester is admin and target user is on local server', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
              .set('Authorization', `Bearer ${validToken2}`)
              .send({ displayname: 'New name' })

            expect(response.statusCode).toBe(200)
            expect(response.body).toEqual({})
          })

          it('should correctly update the display_name of an existing user', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ displayname: 'New name' })
            expect(response.statusCode).toBe(200)
            const rows = await clientServer.matrixDb.get(
              'profiles',
              ['displayname'],
              { user_id: testUserId }
            )

            expect(rows.length).toBe(1)
            expect(rows[0].displayname).toBe('New name')
          })
        })
      })
    })

    describe('/_matrix/client/v3/devices', () => {
      const testUserId = '@testuser:example.com'

      beforeAll(async () => {
        try {
          await clientServer.matrixDb.insert('devices', {
            user_id: testUserId,
            device_id: 'testdevice1',
            display_name: 'Test Device 1',
            last_seen: 1411996332123,
            ip: '127.0.0.1',
            user_agent: 'curl/7.31.0-DEV'
          })
          logger.info('Test device 1 created')

          await clientServer.matrixDb.insert('devices', {
            user_id: testUserId,
            device_id: 'testdevice2',
            display_name: 'Test Device 2',
            last_seen: 14119963321254,
            ip: '127.0.0.2',
            user_agent: 'curl/7.31.0-DEV'
          })
          logger.info('Test device 2 created')
        } catch (e) {
          logger.error('Error creating devices:', e)
        }
      })

      afterAll(async () => {
        try {
          await clientServer.matrixDb.deleteEqual(
            'devices',
            'device_id',
            'testdevice1'
          )
          logger.info('Test device 1 deleted')

          await clientServer.matrixDb.deleteEqual(
            'devices',
            'device_id',
            'testdevice2'
          )
          logger.info('Test device 2 deleted')
        } catch (e) {
          logger.error('Error deleting devices:', e)
        }
      })

      it('should return 401 if the user is not authenticated', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/devices')
          .set('Authorization', 'Bearer invalidToken')
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })

      it('should return all devices for the current user', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/devices')
          .set('Authorization', `Bearer ${validToken}`)

        expect(response.statusCode).toBe(200)

        expect(response.body).toHaveProperty('devices')
        expect(response.body.devices).toHaveLength(2)
        expect(response.body.devices[0]).toHaveProperty('device_id')
        expect(response.body.devices[0]).toHaveProperty('display_name')
        expect(response.body.devices[0]).toHaveProperty('last_seen_ts')
        expect(response.body.devices[0]).toHaveProperty('last_seen_ip')
      })
    })

    describe('/_matrix/client/v3/devices/:deviceId', () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      let _device_id: string
      beforeAll(async () => {
        try {
          _device_id = 'testdevice2_id'
          await clientServer.matrixDb.insert('devices', {
            user_id: '@testuser:example.com',
            device_id: _device_id,
            display_name: 'testdevice2_name',
            last_seen: 12345678,
            ip: '127.0.0.1',
            user_agent: 'curl/7.31.0-DEV',
            hidden: 0
          })

          await clientServer.matrixDb.insert('devices', {
            user_id: '@testuser2:example.com',
            device_id: 'another_device_id',
            display_name: 'another_name',
            last_seen: 12345678,
            ip: '127.0.0.1',
            user_agent: 'curl/7.31.0-DEV',
            hidden: 0
          })
          logger.info('Devices inserted in db')
        } catch (e) {
          logger.error('Error when inserting devices', e)
        }
      })

      afterAll(async () => {
        try {
          await clientServer.matrixDb.deleteEqual(
            'devices',
            'device_id',
            _device_id
          )
          await clientServer.matrixDb.deleteEqual(
            'devices',
            'device_id',
            'another_device_id'
          )
          logger.info('Devices deleted from db')
        } catch (e) {
          logger.error('Error when deleting devices', e)
        }
      })

      describe('GET', () => {
        it('should return the device information for the given device ID', async () => {
          const response = await request(app)
            .get(`/_matrix/client/v3/devices/${_device_id}`)
            .set('Authorization', `Bearer ${validToken}`)

          expect(response.statusCode).toBe(200)

          expect(response.body).toHaveProperty('device_id')
          expect(response.body.device_id).toEqual(_device_id)
          expect(response.body).toHaveProperty('display_name')
          expect(response.body.display_name).toEqual('testdevice2_name')
          expect(response.body).toHaveProperty('last_seen_ip')
          expect(response.body.last_seen_ip).toEqual('127.0.0.1')
          expect(response.body).toHaveProperty('last_seen_ts')
          expect(response.body.last_seen_ts).toEqual(12345678)
        })

        it('should return 404 if the device ID does not exist', async () => {
          const deviceId = 'NON_EXISTENT_DEVICE_ID'
          const response = await request(app)
            .get(`/_matrix/client/v3/devices/${deviceId}`)
            .set('Authorization', `Bearer ${validToken}`)

          expect(response.statusCode).toBe(404)
        })

        it('should return 404 if the user has no device with the given device Id', async () => {
          const response = await request(app)
            .get(`/_matrix/client/v3/devices/another_device_id`)
            .set('Authorization', `Bearer ${validToken}`)

          expect(response.statusCode).toBe(404)
        })

        it('should return 401 if the user is not authenticated', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/devices/${_device_id}`
          )

          expect(response.statusCode).toBe(401)
        })
      })

      describe('PUT', () => {
        const updateData = {
          display_name: 'updated_device_name'
        }

        it('should update the device information for the given device ID', async () => {
          // Update the device
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${_device_id}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send(updateData)
          expect(response.statusCode).toBe(200)

          // Verify the update in the database
          const updatedDevice = await clientServer.matrixDb.get(
            'devices',
            ['device_id', 'display_name'],
            { device_id: _device_id }
          )

          expect(updatedDevice[0]).toHaveProperty('device_id', _device_id)
          expect(updatedDevice[0]).toHaveProperty(
            'display_name',
            updateData.display_name
          )
        })

        it('should return 400 if the display_name is too long', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${_device_id}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ display_name: randomString(257) })

          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        })

        it('should return 404 if the device ID does not exist', async () => {
          const response = await request(app)
            .put('/_matrix/client/v3/devices/NON_EXISTENT_DEVICE_ID')
            .set('Authorization', `Bearer ${validToken}`)
            .send(updateData)

          expect(response.statusCode).toBe(404)
        })

        it('should return 404 if the user has no device with the given device ID', async () => {
          const deviceId = 'another_device_id'
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${deviceId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send(updateData)

          expect(response.statusCode).toBe(404)
        })

        it('should return 401 if the user is not authenticated', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${_device_id}`)
            .send(updateData)

          expect(response.statusCode).toBe(401)
        })
      })
    })
  })

    describe('PUT /_matrix/client/v3/profile/{userId}', () => {
      const testUserId = '@testuser:example.com'

      beforeEach(async () => {
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

      afterEach(async () => {
        clientServer.matrixDb
          .deleteEqual('profiles', 'user_id', testUserId)
          .then(() => {
            logger.info('Test user profile deleted')
          })
          .catch((e) => {
            logger.error('Error deleting test user profile:', e)
          })
      })

      describe('/_matrix/client/v3/profile/{userId}/avatar_url', () => {
        it('should require authentication', async () => {
          await clientServer.cronTasks?.ready
          const response = await request(app)
            .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
            .set('Authorization', 'Bearer invalidToken')
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(401)
        })

        it('should send correct response when updating the avatar_url of an existing user', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ avatar_url: 'http://example.com/new_avatar.jpg' })

          expect(response.statusCode).toBe(200)
          expect(response.body).toEqual({})
        })

        it('should correctly update the avatar_url of an existing user', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ avatar_url: 'http://example.com/new_avatar.jpg' })
          expect(response.statusCode).toBe(200)
          const rows = await clientServer.matrixDb.get(
            'profiles',
            ['avatar_url'],
            { user_id: testUserId }
          )

          expect(rows.length).toBe(1)
          expect(rows[0].avatar_url).toBe('http://example.com/new_avatar.jpg')
        })
      })

      describe('/_matrix/client/v3/profile/{userId}/displayname', () => {
        it('should require authentication', async () => {
          await clientServer.cronTasks?.ready
          const response = await request(app)
            .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
            .set('Authorization', 'Bearer invalidToken')
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(401)
        })

        it('should send correct response when updating the display_name of an existing user', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ displayname: 'New name' })

          expect(response.statusCode).toBe(200)
          expect(response.body).toEqual({})
        })

        it('should correctly update the display_name of an existing user', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ displayname: 'New name' })
          expect(response.statusCode).toBe(200)
          const rows = await clientServer.matrixDb.get(
            'profiles',
            ['displayname'],
            { user_id: testUserId }
          )

          expect(rows.length).toBe(1)
          expect(rows[0].displayname).toBe('New name')
        })
      })
    })

    describe('/_matrix/client/v3/devices', () => {
      const testUserId = '@testuser:example.com'

      beforeAll(async () => {
        clientServer.matrixDb
          .insert('devices', {
            user_id: testUserId,
            device_id: 'testdevice1',
            display_name: 'Test Device 1',
            last_seen: 1411996332123,
            ip: '127.0.0.1',
            user_agent: 'curl/7.31.0-DEV'
          })
          .then(() => {
            clientServer.matrixDb
              .insert('devices', {
                user_id: testUserId,
                device_id: 'testdevice2',
                display_name: 'Test Device 2',
                last_seen: 14119963321254,
                ip: '127.0.0.2',
                user_agent: 'curl/7.31.0-DEV'
              })
              .then(() => {
                logger.info('Test device 2 created')
              })
              .catch((e) => {
                logger.error('Error creating test 2 device:', e)
              })
            logger.info('Test device 1 created')
          })
          .catch((e) => {
            logger.error('Error creating test 1 device:', e)
          })
      })

      afterAll(async () => {
        clientServer.matrixDb
          .deleteEqual('devices', 'device_id', 'testdevice1')
          .then(() => {
            clientServer.matrixDb
              .deleteEqual('devices', 'device_id', 'testdevice2')
              .then(() => {
                logger.info('Test device 2 deleted')
              })
              .catch((e) => {
                logger.error('Error deleting test device 2:', e)
              })
            logger.info('Test device 1 deleted')
          })
          .catch((e) => {
            logger.error('Error deleting test device 1:', e)
          })
      })

      it('should return 401 if the user is not authenticated', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/devices')
          .set('Authorization', 'Bearer invalidToken')

        expect(response.statusCode).toBe(401)
      })

      it('should return all devices for the current user', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/devices')
          .set('Authorization', `Bearer ${validToken}`)

        expect(response.statusCode).toBe(200)

        expect(response.body).toHaveProperty('devices')
        expect(response.body.devices).toHaveLength(2)
        expect(response.body.devices[0]).toHaveProperty('device_id')
        expect(response.body.devices[0]).toHaveProperty('display_name')
        expect(response.body.devices[0]).toHaveProperty('last_seen_ts')
        expect(response.body.devices[0]).toHaveProperty('last_seen_ip')
      })
    })

    describe('/_matrix/client/v3/devices/:deviceId', () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      let _device_id: string
      beforeAll(async () => {
        _device_id = 'testdevice2_id'
        await clientServer.matrixDb
          .insert('devices', {
            user_id: '@testuser:example.com',
            device_id: _device_id,
            display_name: 'testdevice2_name',
            last_seen: 12345678,
            ip: '127.0.0.1',
            user_agent: 'curl/7.31.0-DEV',
            hidden: 0
          })
          .then(() => {
            logger.info('device inserted in db')
          })
          .catch((e) => {
            logger.error('error when inserting device', e)
          })
        await clientServer.matrixDb
          .insert('devices', {
            user_id: '@testuser2:example.com',
            device_id: 'another_device_id',
            display_name: 'another_name',
            last_seen: 12345678,
            ip: '127.0.0.1',
            user_agent: 'curl/7.31.0-DEV',
            hidden: 0
          })
          .then(() => {
            logger.info('another device inserted in db')
          })
          .catch((e) => {
            logger.error('error when inserting another device', e)
          })
      })

      describe('GET /_matrix/client/v3/devices/:deviceId', () => {
        it('should return the device information for the given device ID', async () => {
          const response = await request(app)
            .get(`/_matrix/client/v3/devices/${_device_id}`)
            .set('Authorization', `Bearer ${validToken}`)

          expect(response.statusCode).toBe(200)

          expect(response.body).toHaveProperty('device_id')
          expect(response.body.device_id).toEqual(_device_id)
          expect(response.body).toHaveProperty('display_name')
          expect(response.body.display_name).toEqual('testdevice2_name')
          expect(response.body).toHaveProperty('last_seen_ip')
          expect(response.body.last_seen_ip).toEqual('127.0.0.1')
          expect(response.body).toHaveProperty('last_seen_ts')
          expect(response.body.last_seen_ts).toEqual(12345678)
        })

        it('should return 404 if the device ID does not exist', async () => {
          const deviceId = 'NON_EXISTENT_DEVICE_ID'
          const response = await request(app)
            .get(`/_matrix/client/v3/devices/${deviceId}`)
            .set('Authorization', `Bearer ${validToken}`)

          expect(response.statusCode).toBe(404)
        })

        it('should return 404 if the user has no device with the given device Id', async () => {
          const response = await request(app)
            .get(`/_matrix/client/v3/devices/another_device_id`)
            .set('Authorization', `Bearer ${validToken}`)

          expect(response.statusCode).toBe(404)
        })

        it('should return 401 if the user is not authenticated', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/devices/${_device_id}`
          )

          expect(response.statusCode).toBe(401)
        })
      })

      describe('PUT', () => {
        const updateData = {
          display_name: 'updated_device_name'
        }

        it('should update the device information for the given device ID', async () => {
          // Update the device
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${_device_id}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send(updateData)
          expect(response.statusCode).toBe(200)

          // Verify the update in the database
          const updatedDevice = await clientServer.matrixDb.get(
            'devices',
            ['device_id', 'display_name'],
            { device_id: _device_id }
          )

          expect(updatedDevice[0]).toHaveProperty('device_id', _device_id)
          expect(updatedDevice[0]).toHaveProperty(
            'display_name',
            updateData.display_name
          )
        })

        it('should return 404 if the device ID does not exist', async () => {
          const response = await request(app)
            .put('/_matrix/client/v3/devices/NON_EXISTENT_DEVICE_ID')
            .set('Authorization', `Bearer ${validToken}`)
            .send(updateData)

          expect(response.statusCode).toBe(404)
        })

        it('should return 404 if the user has no device with the given device ID', async () => {
          const deviceId = 'another_device_id'
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${deviceId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send(updateData)

          expect(response.statusCode).toBe(404)
        })

        it('should return 401 if the user is not authenticated', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${_device_id}`)
            .send(updateData)

          expect(response.statusCode).toBe(401)
        })
      })
    })

    describe('/_matrix/client/v3/directory/list/room/:roomId', () => {
      describe('GET', () => {
        const publicRoomId = '!testroomid:example.com'
        const privateRoomId = '!private:example.com'

        beforeAll(async () => {
          try {
            await clientServer.matrixDb.insert('rooms', {
              room_id: publicRoomId,
              is_public: 1
            })

            await clientServer.matrixDb.insert('rooms', {
              room_id: privateRoomId,
              is_public: 0
            })

            await clientServer.matrixDb.insert('rooms', {
              room_id: '!anotherroomid:example.com'
            })
          } catch (e) {
            logger.error('Error setting up test data:', e)
          }
        })

        afterAll(async () => {
          try {
            await clientServer.matrixDb.deleteEqual(
              'rooms',
              'room_id',
              publicRoomId
            )

            await clientServer.matrixDb.deleteEqual(
              'rooms',
              'room_id',
              privateRoomId
            )

            await clientServer.matrixDb.deleteEqual(
              'rooms',
              'room_id',
              '!anotherroomid:example.com'
            )
          } catch (e) {
            logger.error('Error tearing down test data:', e)
          }
        })

        it('should return the correct visibility for a public room', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/directory/list/room/${publicRoomId}`
          )
          expect(response.statusCode).toBe(200)
          expect(response.body).toEqual({
            visibility: 'public'
          })
        })

        it('should return the correct visibility for a private room', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/directory/list/room/${privateRoomId}`
          )
          expect(response.statusCode).toBe(200)
          expect(response.body).toEqual({
            visibility: 'private'
          })
        })

        it('should return private visibility if no visibility is set', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/directory/list/room/!anotherroomid:example.com`
          )
          expect(response.statusCode).toBe(200)
          expect(response.body).toEqual({
            visibility: 'private'
          })
        })

        it('should return 404 if the room is not found', async () => {
          const invalidRoomId = '!invalidroomid:example.com'
          const response = await request(app).get(
            `/_matrix/client/v3/directory/list/room/${invalidRoomId}`
          )
          expect(response.statusCode).toBe(404)
          expect(response.body).toEqual({
            errcode: 'M_NOT_FOUND',
            error: 'Room not found'
          })
        })
      })

      describe('PUT', () => {
        const testRoomId = '!testroomid:example.com'

        beforeAll(async () => {
          try {
            await clientServer.matrixDb.insert('rooms', {
              room_id: testRoomId,
              is_public: 1
            })
          } catch (e) {
            logger.error('Error setting up test data:', e)
          }
        })

        afterAll(async () => {
          try {
            await clientServer.matrixDb.deleteEqual(
              'rooms',
              'room_id',
              testRoomId
            )
          } catch (e) {
            logger.error('Error tearing down test data:', e)
          }
        })

        it('should require authentication', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/directory/list/room/${testRoomId}`)
            .set('Authorization', 'Bearer invalidToken')
            .set('Accept', 'application/json')
            .send({ visibility: 'private' })
          expect(response.statusCode).toBe(401)
        })

        it('should return 400 invalidParams if wrong parameters given', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/directory/list/room/${testRoomId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({ visibility: 'wrongParams' })
          expect(response.statusCode).toBe(400)
          expect(response.body.errcode).toBe('M_INVALID_PARAM')
        })

        it('should update the visibility of the room', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/directory/list/room/${testRoomId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ visibility: 'private' })
          expect(response.statusCode).toBe(200)

          const row = await clientServer.matrixDb.get('rooms', ['is_public'], {
            room_id: testRoomId
          })
          expect(row[0].is_public).toBe(0)
        })

        it('should update the visibility of the room', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/directory/list/room/${testRoomId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ visibility: 'public' })
          expect(response.statusCode).toBe(200)

          const row = await clientServer.matrixDb.get('rooms', ['is_public'], {
            room_id: testRoomId
          })
          expect(row[0].is_public).toBe(1)
        })

        it('should return 404 if the room is not found', async () => {
          const invalidRoomId = '!invalidroomid:example.com'
          const response = await request(app)
            .put(`/_matrix/client/v3/directory/list/room/${invalidRoomId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ visibility: 'private' })
          expect(response.statusCode).toBe(404)
          expect(response.body).toEqual({
            errcode: 'M_NOT_FOUND',
            error: 'Room not found'
          })
        })
      })
    })

    describe('/_matrix/client/v3/rooms/:roomId/aliases', () => {
      const testUserId = '@testuser:example.com'
      const testRoomId = '!testroomid:example.com'
      const worldReadableRoomId = '!worldreadable:example.com'

      beforeAll(async () => {
        try {
          // Insert test data for room aliases
          await clientServer.matrixDb.insert('room_aliases', {
            room_id: testRoomId,
            room_alias: '#somewhere:example.com'
          })
          await clientServer.matrixDb.insert('room_aliases', {
            room_id: testRoomId,
            room_alias: '#another:example.com'
          })
          await clientServer.matrixDb.insert('room_aliases', {
            room_id: worldReadableRoomId,
            room_alias: '#worldreadable:example.com'
          })

          // Insert test data for room visibility
          await clientServer.matrixDb.insert('room_stats_state', {
            room_id: worldReadableRoomId,
            history_visibility: 'world_readable'
          })
          await clientServer.matrixDb.insert('room_stats_state', {
            room_id: testRoomId,
            history_visibility: 'joined'
          })

          // Insert test data for room membership
          await clientServer.matrixDb.insert('room_memberships', {
            user_id: testUserId,
            room_id: testRoomId,
            membership: 'join',
            forgotten: 0,
            event_id: randomString(20),
            sender: '@admin:example.com'
          })
        } catch (e) {
          logger.error('Error setting up test data:', e)
        }
      })

      afterAll(async () => {
        try {
          // Clean up test data
          await clientServer.matrixDb.deleteEqual(
            'room_aliases',
            'room_id',
            testRoomId
          )
          await clientServer.matrixDb.deleteEqual(
            'room_aliases',
            'room_id',
            worldReadableRoomId
          )
          await clientServer.matrixDb.deleteEqual(
            'room_stats_state',
            'room_id',
            worldReadableRoomId
          )
          await clientServer.matrixDb.deleteEqual(
            'room_stats_state',
            'room_id',
            testRoomId
          )
          await clientServer.matrixDb.deleteEqual(
            'room_memberships',
            'room_id',
            testRoomId
          )
        } catch (e) {
          logger.error('Error tearing down test data:', e)
        }
      })

      it('should require authentication', async () => {
        const response = await request(app)
          .get(`/_matrix/client/v3/rooms/${testRoomId}/aliases`)
          .set('Authorization', 'Bearer invalidToken')
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })

      it('should return 400 if the room ID is invalid', async () => {
        const response = await request(app)
          .get(`/_matrix/client/v3/rooms/invalid_room_id/aliases`)
          .set('Authorization', `Bearer ${validToken2}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(400)
        expect(response.body.errcode).toEqual('M_INVALID_PARAM')
      })

      it('should return the list of aliases for a world_readable room for any user', async () => {
        const response = await request(app)
          .get(`/_matrix/client/v3/rooms/${worldReadableRoomId}/aliases`)
          .set('Authorization', `Bearer ${validToken2}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body).toEqual({
          aliases: ['#worldreadable:example.com']
        })
      })

      it('should return the list of aliases for an non-world_readable room if the user is a member', async () => {
        const response = await request(app)
          .get(`/_matrix/client/v3/rooms/${testRoomId}/aliases`)
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body).toEqual({
          aliases: ['#somewhere:example.com', '#another:example.com']
        })
      })

      it('should return 403 if the user is not a member and the room is not world_readable', async () => {
        const response = await request(app)
          .get(`/_matrix/client/v3/rooms/${testRoomId}/aliases`)
          .set('Authorization', `Bearer ${validToken2}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(403)
        expect(response.body).toEqual({
          errcode: 'M_FORBIDDEN',
          error:
            'The user is not permitted to retrieve the list of local aliases for the room'
        })
      })

      it('should return 400 if the room ID is invalid', async () => {
        const invalidRoomId = '!invalidroomid:example.com'

        const response = await request(app)
          .get(`/_matrix/client/v3/rooms/${invalidRoomId}/aliases`)
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(400)
        expect(response.body).toEqual({
          errcode: 'M_INVALID_PARAM',
          error: 'Invalid room id'
        })
      })
    })
  })
})
