import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../../index'
import fetch from 'node-fetch'
import { buildMatrixDb, buildUserDB } from '../../__testData__/buildUserDB'
import { type Config } from '../../types'
import defaultConfig from '../../__testData__/3pidConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { randomString } from '@twake/crypto'
import { epoch } from '@twake/utils'

process.env.TWAKE_CLIENT_SERVER_CONF = './src/__testData__/3pidConf.json'
jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))
const sendSMSMock = jest.fn()
jest.mock('../../utils/smsSender', () => {
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
  fs.unlinkSync('src/__testData__/testThreepid.db')
  fs.unlinkSync('src/__testData__/testMatrixThreepid.db')
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

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mock('node-fetch', () => jest.fn())
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

        await clientServer.matrixDb.insert('threepid_validation_session', {
          session_id: 'validatedSession',
          medium: 'email',
          address: 'validated@example.com',
          client_secret: 'validatedSecret',
          last_send_attempt: 1,
          validated_at: epoch()
        }) // Validated session
        await clientServer.matrixDb.insert('user_threepids', {
          user_id: '@validated:example.com',
          medium: 'email',
          address: 'validated@example.com',
          validated_at: epoch(),
          added_at: epoch()
        })
      } catch (e) {
        logger.error('Error creating tokens for authentification', e)
      }
    })
    describe('/_matrix/client/v3/account/3pid/add', () => {
      let sid: string
      let token: string
      it('should refuse an invalid secret', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .send({
            sid: 'sid',
            client_secret: 'my',
            auth: { type: 'm.login.dummy', session: 'authSession' }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid client_secret')
      })
      it('should refuse an invalid session ID', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .send({
            sid: '$!:',
            client_secret: 'mysecret',
            auth: { type: 'm.login.dummy', session: 'authSession2' }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid session ID')
      })
      it('should return 400 for a wrong combination of client secret and session ID', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .send({
            sid: 'wrongSid',
            client_secret: 'mysecret',
            auth: { type: 'm.login.dummy', session: 'authSession3' }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_NO_VALID_SESSION')
      })
      it('should refuse to add a 3pid if the session has not been validated', async () => {
        const requesTokenResponse = await request(app)
          .post('/_matrix/client/v3/register/email/requestToken')
          .set('Accept', 'application/json')
          .send({
            client_secret: 'mysecret',
            email: 'xg@xnr.fr',
            next_link: 'http://localhost:8090',
            send_attempt: 1
          })
        expect(requesTokenResponse.statusCode).toBe(200)
        expect(sendMailMock.mock.calls[0][0].to).toBe('xg@xnr.fr')
        expect(sendMailMock.mock.calls[0][0].raw).toMatch(
          /token=([a-zA-Z0-9]{64})&client_secret=mysecret&sid=([a-zA-Z0-9]{64})/
        )
        token = RegExp.$1
        sid = RegExp.$2
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .send({
            sid,
            client_secret: 'mysecret',
            auth: { type: 'm.login.dummy', session: 'authSession4' }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty(
          'errcode',
          'M_SESSION_NOT_VALIDATED'
        )
      })
      it('should accept to add a 3pid if the session has been validated', async () => {
        const submitTokenResponse = await request(app)
          .post('/_matrix/client/v3/register/email/submitToken')
          .send({
            token,
            client_secret: 'mysecret',
            sid
          })
          .set('Accept', 'application/json')
        expect(submitTokenResponse.statusCode).toBe(200)
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .send({
            sid,
            client_secret: 'mysecret',
            auth: {
              type: 'm.login.email.identity',
              session: 'validatedSession',
              threepid_creds: {
                sid: 'validatedSession',
                client_secret: 'validatedSecret'
              }
            }
          })
        expect(response.statusCode).toBe(200)
      })
      it('should refuse adding a 3pid already associated to another user', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .send({
            sid,
            client_secret: 'mysecret',
            auth: {
              type: 'm.login.dummy',
              session: 'authSession9'
            }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_THREEPID_IN_USE')
      })
      it('should refuse authenticating a user with an unknown 3pid for UI Auth', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .send({
            sid: 'sid',
            client_secret: 'mysecret',
            auth: {
              type: 'm.login.msisdn',
              session: 'authSession7',
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
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .send({
            sid: 'sid',
            client_secret: 'mysecret',
            auth: {
              type: 'm.login.msisdn',
              session: 'authSession8',
              threepid_creds: { sid, client_secret: 'secret' }
            }
          })
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
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .send({
            sid: 'sid',
            client_secret: 'mysecret',
            auth: {
              type: 'm.login.msisdn',
              session: 'authSession8',
              threepid_creds: { sid, client_secret: 'secret' } // Unknown 3pid
            }
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('errcode', 'M_THREEPID_NOT_FOUND')
      })
      it('should refuse adding a userId that is not of the right format', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .send({
            sid,
            client_secret: 'secret',
            auth: {
              type: 'm.login.dummy', // what happens when the Ui Auth is validated with a Dummy auth as the last stage, the userId is set to '' which is wrong
              session: 'authSession5'
            }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      })
    })
    describe('/_matrix/client/v3/account/3pid/bind', () => {
      it('should return 200 on a successful bind', async () => {
        const mockResponse = Promise.resolve({
          ok: true,
          status: 200,
          json: () => {
            return {
              medium: 'email',
              address: 'localhost@example.com',
              mxid: '@testuser:example.com',
              not_after: 1234567890,
              not_before: 1234567890,
              signatures: {},
              ts: 1234567890
            }
          }
        })
        // @ts-expect-error mock is unknown
        fetch.mockImplementation(async () => await mockResponse)
        await mockResponse
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/bind')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            client_secret: 'mysecret',
            id_access_token: 'myaccesstoken',
            id_server: 'http://localhost:8090',
            sid: 'mysid'
          })
        expect(response.statusCode).toBe(200)
      })
      it('should return an error if bind fails', async () => {
        const mockResponse = Promise.resolve({
          ok: false,
          status: 400,
          json: () => {
            return {
              errcode: 'M_SESSION_NOT_VALIDATED',
              error: 'This validation session has not yet been completed'
            }
          }
        })
        // @ts-expect-error mock is unknown
        fetch.mockImplementation(async () => await mockResponse)
        await mockResponse
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/bind')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            client_secret: 'mysecret',
            id_access_token: 'myaccesstoken',
            id_server: 'http://localhost:8090',
            sid: 'mysid'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty(
          'errcode',
          'M_SESSION_NOT_VALIDATED'
        )
        expect(response.body).toHaveProperty(
          'error',
          'This validation session has not yet been completed'
        )
      })
    })
  })
})
