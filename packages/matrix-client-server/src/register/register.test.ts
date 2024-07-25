import { getLogger, type TwakeLogger } from '@twake/logger'
import { type Response } from 'supertest'
import ClientServer from '../index'
import { type Config } from '../types'
import express from 'express'
import defaultConfig from '../__testData__/registerConf.json'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import fs from 'fs'
import request from 'supertest'
import { setupTokens, validToken } from '../utils/setupTokens'

jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))
const sendSMSMock = jest.fn()
jest.mock('../utils/smsSender', () => {
  return jest.fn().mockImplementation(() => {
    return {
      sendSMS: sendSMSMock
    }
  })
})

let conf: Config
let clientServer: ClientServer
let app: express.Application

const logger: TwakeLogger = getLogger()

const policies = {
  privacy_policy: {
    en: {
      name: 'Privacy Policy',
      url: 'https://example.org/somewhere/privacy-1.2-en.html'
    },
    fr: {
      name: 'Politique de confidentialité',
      url: 'https://example.org/somewhere/privacy-1.2-fr.html'
    },
    version: '1.2'
  },
  terms_of_service: {
    en: {
      name: 'Terms of Service',
      url: 'https://example.org/somewhere/terms-2.0-en.html'
    },
    fr: {
      name: "Conditions d'utilisation",
      url: 'https://example.org/somewhere/terms-2.0-fr.html'
    },
    version: '2.0'
  }
}

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
    userdb_host: 'testRegister.db',
    policies
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
    app.set('trust proxy', 1)
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
    let guestToken: string
    beforeAll(async () => {
      await setupTokens(clientServer, logger)
    })
    describe('User Interactive Authentication', () => {
      let token: string
      let sid: string
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
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.registration_token',
              token: 'exampleToken',
              session
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('error')
        expect(response.body).toHaveProperty('errcode')
      })
      it('should accept authentication with m.login.email.identity', async () => {
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
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.email.identity',
              session,
              threepid_creds: {
                sid: 'validatedSession2',
                client_secret: 'validatedSecret2'
              }
            }
          })
        expect(response.statusCode).toBe(200)
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
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({
            auth: {
              type: 'm.login.terms',
              session
            }
          })
        expect(response.statusCode).toBe(200)
      })
      it('should refuse authenticating a user with an unknown 3pid for UI Auth', async () => {
        const response1 = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .send({ password: 'password' })
        expect(response1.statusCode).toBe(401)
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .set('Accept', 'application/json')
          .send({
            auth: {
              type: 'm.login.msisdn',
              session,
              threepid_creds: { sid: 'sid', client_secret: 'mysecret' } // Unknown 3pid
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('errcode', 'M_NO_VALID_SESSION')
      })
      it('should refuse authenticating a user whose session has not been validated', async () => {
        const requestTokenResponse = await request(app)
          .post('/_matrix/client/v3/register/msisdn/requestToken')
          .set('Accept', 'application/json')
          .send({
            client_secret: 'secret',
            country: 'FR',
            phone_number: '000000000',
            next_link: 'http://localhost:8090',
            send_attempt: 1
          })
        expect(requestTokenResponse.statusCode).toBe(200)
        expect(sendSMSMock.mock.calls[0][0].raw).toMatch(
          /token=([a-zA-Z0-9]{64})&client_secret=secret&sid=([a-zA-Z0-9]{64})/
        )
        token = RegExp.$1
        sid = RegExp.$2
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('Accept', 'application/json')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .set('Accept', 'application/json')
          .send({
            auth: {
              type: 'm.login.msisdn',
              session,
              threepid_creds: { sid, client_secret: 'secret' }
            }
          })
        console.log(response.body)
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty(
          'errcode',
          'M_SESSION_NOT_VALIDATED'
        )
      })
      it('should refuse authenticating a user with an email that has not been added to a matrix userId', async () => {
        const submitTokenResponse = await request(app)
          .post('/_matrix/client/v3/register/email/submitToken')
          .send({
            token,
            client_secret: 'secret',
            sid
          })
          .set('Accept', 'application/json')
        expect(submitTokenResponse.statusCode).toBe(200)
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('Accept', 'application/json')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .set('Accept', 'application/json')
          .send({
            auth: {
              type: 'm.login.msisdn',
              session,
              threepid_creds: { sid, client_secret: 'secret' }
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('errcode', 'M_THREEPID_NOT_FOUND')
      })
      it('should refuse authenticating with an unknown session Id', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .set('Accept', 'application/json')
          .send({
            auth: {
              type: 'm.login.msisdn',
              session: 'unknownSession',
              threepid_creds: { sid, client_secret: 'secret' }
            }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_NO_VALID_SESSION')
      })
      it('should refuse authenticating if the uri changes during the process', async () => {
        const response1 = await request(app)
          .post('/_matrix/client/v3/register')
          .set('User-Agent', 'curl/7.31.0-DEV')
          .set('X-Forwarded-For', '203.0.113.195')
          .query({ kind: 'user' })
          .set('Accept', 'application/json')
          .send({})
        expect(response1.statusCode).toBe(401)
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: 'sid',
            client_secret: 'cs',
            auth: {
              type: 'm.login.email.identity',
              threepid_creds: { sid: 'sid', client_secret: 'cs' },
              session
            }
          })
        expect(response.statusCode).toBe(403)
        expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
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
          password: 'newpassword',
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
    it('should refuse an invalid kind', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'wrongkind' })
        .send({})
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty(
        'error',
        'Kind must be either "guest" or "user"'
      )
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
    })
    it('should refuse an invalid refresh_token', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.1113.195')
        .query({ kind: 'user' })
        .send({
          refresh_token: 'notaboolean'
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty(
        'error',
        'Invalid refresh_token: expected boolean, got string'
      )
    })
    it('should refuse an invalid password', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.1113.195')
        .query({ kind: 'user' })
        .send({ password: 400 })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty(
        'error',
        'Invalid password: expected string, got number'
      )
    })
    it('should refuse an invalid initial_device_display_name', async () => {
      let initialDeviceDisplayName = ''
      for (let i = 0; i < 1000; i++) {
        initialDeviceDisplayName += 'a'
      }
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.1113.195')
        .query({ kind: 'user' })
        .send({
          initial_device_display_name: initialDeviceDisplayName
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty(
        'error',
        'initial_device_display_name exceeds 512 characters'
      )
    })
    it('should refuse an invalid deviceId', async () => {
      let deviceId = ''
      for (let i = 0; i < 1000; i++) {
        deviceId += 'a'
      }
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.1113.195')
        .query({ kind: 'user' })
        .send({
          device_id: deviceId
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty(
        'error',
        'device_id exceeds 512 characters'
      )
    })
    it('should only return the userId when inhibit login is set to true', async () => {
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
      session = response1.body.session
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          auth: { type: 'm.login.dummy', session },
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
      session = response1.body.session
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          auth: {
            type: 'm.login.dummy',
            session
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
      guestToken = response.body.access_token
    })
    it('should refuse to upgrade a guest account if no username is provided', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'guest', guest_access_token: guestToken })
        .send({})
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('errcode', 'M_MISSING_PARAMS')
    })
    it('should refuse to upgrade a guest account with the wrong token', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'guest', guest_access_token: 'wrongToken' })
        .send({ username: 'guest' })
      expect(response.statusCode).toBe(401)
      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('errcode', 'M_UNKNOWN_TOKEN')
    })
    it('should upgrade a guest account if all parameters are present', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'guest', guest_access_token: guestToken })
        .send({
          username: 'guest',
          password: 'newpassword',
          refresh_token: true
        })
      expect(response.statusCode).toBe(200)
      expect(response.body).toHaveProperty('user_id')
    })
    it('should refuse to upgrade a guest account with a wrong deviceId', async () => {
      let deviceId = ''
      for (let i = 0; i < 1000; i++) {
        deviceId += 'b'
      }
      const response1 = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.1113.195')
        .query({ kind: 'guest' })
        .send({})
      expect(response1.statusCode).toBe(200)
      expect(response1.body).toHaveProperty('access_token')
      guestToken = response1.body.access_token
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.1113.195')
        .query({ guest_access_token: guestToken, kind: 'guest' })
        .send({
          username: 'guest2',
          device_id: deviceId
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid device_id')
    })
    it('should refuse a username that is already in use', async () => {
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
      session = response1.body.session
      const response = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          username: 'newuser',
          auth: { type: 'm.login.dummy', session }
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
    it('should reject if more than 100 requests are done in less than 10 seconds', async () => {
      let response
      // eslint-disable-next-line @typescript-eslint/no-for-in-array, @typescript-eslint/no-unused-vars
      for (const i in [...Array(101).keys()]) {
        response = await request(app)
          .get('/_matrix/client/v3/register/available')
          .query({ username: `@username${i}:example.org` })
          .set('Accept', 'application/json')
      }
      expect((response as Response).statusCode).toEqual(429)
      await new Promise((resolve) => setTimeout(resolve, 11000))
    })
    it('should refuse an invalid username', async () => {
      const response = await request(app)
        .get('/_matrix/client/v3/register/available')
        .query({ username: 'invalidUsername' })
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
    })
    it('should refuse a username that is in an exclusive namespace', async () => {
      const response = await request(app)
        .get('/_matrix/client/v3/register/available')
        .query({ username: '@_irc_bridge_:example.com' })
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('errcode', 'M_EXCLUSIVE')
    })
    it('should refuse a username that is already in use', async () => {
      const response = await request(app)
        .get('/_matrix/client/v3/register/available')
        .query({ username: '@newuser:example.com' }) // registered in a previous test
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('errcode', 'M_USER_IN_USE')
    })
    it('should accept a username that is available', async () => {
      const response = await request(app)
        .get('/_matrix/client/v3/register/available')
        .query({ username: '@newuser2:example.com' })
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(200)
      expect(response.body).toHaveProperty('available', true)
    })
  })
})
