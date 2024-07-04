import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from './index'
import { buildMatrixDb, buildUserDB } from './__testData__/buildUserDB'
import { AuthenticationTypes, type Config } from './types'
import defaultConfig from './__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { randomString } from '@twake/crypto'

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
    matrix_database_engine: 'sqlite',
    flows: [
      {
        stages: [AuthenticationTypes.Password, AuthenticationTypes.Dummy]
      },
      {
        stages: [AuthenticationTypes.Password, AuthenticationTypes.Email]
      }
    ],
    params: {
      'm.login.terms': {
        policies: {
          terms_of_service: {
            version: '1.2',
            en: {
              name: 'Terms of Service',
              url: 'https://example.org/somewhere/terms-1.2-en.html'
            },
            fr: {
              name: "Conditions d'utilisation",
              url: 'https://example.org/somewhere/terms-1.2-fr.html'
            }
          }
        }
      }
    }
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
    describe('/_matrix/client/v3/admin/whois/{userId}', () => {
      it('should refuse a request with a wrong userId', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/admin/whois/@unknownuser:example.com')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(400)
      })
      it('should refuse a request with a userId that does not match the regex', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/admin/whois/invalidUserId')
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
          .get('/_matrix/client/v3/admin/whois/@testuser:example.com')
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
          .get('/_matrix/client/v3/admin/whois/@testuser:example.com')
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
    describe('/_matrix/client/v3/presence/{userId}/status', () => {
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
  })
})
