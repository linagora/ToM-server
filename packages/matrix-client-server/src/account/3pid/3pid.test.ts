import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../../index'
import fetch from 'node-fetch'
import { buildMatrixDb, buildUserDB } from '../../__testData__/buildUserDB'
import { type Config } from '../../types'
import defaultConfig from '../../__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import {
  setupTokens,
  validToken,
  validToken2
} from '../../__testData__/setupTokens'
import { epoch } from '@twake/utils'

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
    matrix_database_engine: 'sqlite',
    matrix_database_host: './src/__testData__/testMatrixThreepid.db',
    database_host: './src/__testData__/testThreepid.db',
    userdb_host: './src/__testData__/testThreepid.db'
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
    describe('/_matrix/client/v3/account/3pid/add', () => {
      let session: string
      describe('User Interactive Authentication', () => {
        it('should refuse to validate a userId that does not match the regex', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/account/3pid/add')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer wrongUserAccessToken`)
            .send({
              sid: 'sid',
              client_secret: 'clientsecret'
            })
          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          expect(response.body).toHaveProperty('error', 'Invalid user ID')
        })
        it('should refuse to authenticate a user with a password if he does not have one registered', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/account/3pid/add')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${validToken2}`)
            .send({
              sid: 'sid',
              client_secret: 'clientsecret'
            })
          expect(response.statusCode).toBe(401)
          session = response.body.session
          const response1 = await request(app)
            .post('/_matrix/client/v3/account/3pid/add')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${validToken2}`)
            .send({
              sid: 'sid',
              client_secret: 'clientsecret',
              auth: {
                type: 'm.login.password',
                session,
                password: 'password',
                identifier: {
                  type: 'm.id.user',
                  user: '@testuser2:example.com'
                }
              }
            })
          expect(response1.statusCode).toBe(401)
          expect(response1.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          expect(response1.body).toHaveProperty(
            'error',
            'The user does not have a password registered or the provided password is wrong.'
          )
        })
      })
      let sid: string
      let token: string
      it('should refuse an invalid secret', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: 'sid',
            client_secret: 'my',
            auth: {
              type: 'm.login.password',
              session: 'session',
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              identifier: { type: 'm.id.user', user: '@testuser:example.com' }
            }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid client_secret')
      })
      it('should refuse an invalid session ID', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: '$;!',
            client_secret: 'mysecret',
            auth: {
              type: 'm.login.password',
              session: 'session',
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              identifier: { type: 'm.id.user', user: '@testuser:example.com' }
            }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid session ID')
      })
      it('should refuse an invalid auth', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: 'sid',
            client_secret: 'mysecret',
            auth: {
              type: 'invalidtype'
            }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty(
          'error',
          'Invalid authentication data'
        )
      })
      it('should return 400 for a wrong combination of client secret and session ID', async () => {
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({})
        expect(response1.statusCode).toBe(401)
        expect(response1.body).toHaveProperty('session')
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: 'wrongSid',
            client_secret: 'mysecret',
            auth: {
              type: 'm.login.password',
              session,
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              identifier: { type: 'm.id.user', user: '@testuser:example.com' }
            }
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
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: 'sid',
            client_secret: 'mysecret'
          })
        expect(response1.statusCode).toBe(401)
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid,
            client_secret: 'mysecret',
            auth: {
              type: 'm.login.password',
              session,
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              identifier: { type: 'm.id.user', user: '@testuser:example.com' }
            }
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
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: 'sid',
            client_secret: 'mysecret'
          })
        expect(response1.statusCode).toBe(401)
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid,
            client_secret: 'mysecret',
            auth: {
              type: 'm.login.password',
              session,
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              identifier: { type: 'm.id.user', user: '@testuser:example.com' }
            }
          })
        expect(response.statusCode).toBe(200)
      })
      it('should refuse adding a 3pid already associated to another user', async () => {
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: 'sid',
            client_secret: 'mysecret'
          })
        expect(response1.statusCode).toBe(401)
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid,
            client_secret: 'mysecret',
            auth: {
              type: 'm.login.password',
              session,
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              identifier: { type: 'm.id.user', user: '@testuser:example.com' }
            }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_THREEPID_IN_USE')
      })
      it('should refuse to add a 3pid if the user is not an admin and the server does not allow it', async () => {
        clientServer.conf.capabilities.enable_3pid_changes = false
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid: 'sid',
            client_secret: 'mysecret'
          })
        expect(response1.statusCode).toBe(401)
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/add')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            sid,
            client_secret: 'mysecret',
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
          'Cannot add 3pid as it is not allowed by server'
        )
        delete clientServer.conf.capabilities.enable_3pid_changes
      })
      // Used to work but not anymore since we only check UI Auth with m.login.password or m.login.sso
      // it('should refuse adding a userId that is not of the right format', async () => {
      //   const response = await request(app)
      //     .post('/_matrix/client/v3/account/3pid/add')
      //     .set('Accept', 'application/json')
      //     .set('Authorization', `Bearer ${validToken}`)
      //     .send({
      //       sid,
      //       client_secret: 'mysecret',
      //       auth: {
      //         type: 'm.login.password',
      //         session: 'authSession7',
      //         password:
      //           '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
      //         identifier: { type: 'm.id.user', user: '@testuser:example.com' }
      //       }
      //     })
      //   expect(response.statusCode).toBe(400)
      //   expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      // })
    })
    describe('/_matrix/client/v3/account/3pid/delete', () => {
      it('should return 403 if the user is not an admin and the server does not allow it', async () => {
        clientServer.conf.capabilities.enable_3pid_changes = false
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/delete')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            medium: 'email',
            address: 'testuser@example.com'
          })

        expect(response.statusCode).toBe(403)
        expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
        expect(response.body).toHaveProperty(
          'error',
          'Cannot add 3pid as it is not allowed by server'
        )
        delete clientServer.conf.capabilities.enable_3pid_changes
      })
      it('should refuse an invalid medium', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/delete')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            medium: 'wrongmedium',
            address: 'testuser@example.com'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty(
          'error',
          'Invalid medium, medium must be either email or msisdn'
        )
      })
      it('should refuse an invalid email', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/delete')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            medium: 'email',
            address: 'testuser'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid email address')
      })
      it('should refuse an invalid phone number', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/delete')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            medium: 'msisdn',
            address: 'testuser'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid phone number')
      })
      it('should unbind from the id server provided in the request body', async () => {
        const mockResolveResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              email: 'dwho@example.com',
              'm.server': 'matrix.example.com:8448'
            })
        })

        const mockRegisterResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              token: 'validToken'
            })
        })
        const mockUnbindResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              address: 'testuser@example.com',
              medium: 'email'
            })
        })
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockResolveResponse)
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockRegisterResponse)
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockUnbindResponse)

        await clientServer.matrixDb.insert('user_threepid_id_server', {
          address: 'testuser@example.com',
          medium: 'email',
          user_id: '@testuser:example.com',
          id_server: 'matrix.example.com'
        })

        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/delete')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            medium: 'email',
            address: 'testuser@example.com',
            id_server: 'matrix.example.com'
          })
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty(
          'id_server_unbind_result',
          'success'
        )
      })
      it('should unbind from the identity server that was used to bind the threepid if no id_server is provided', async () => {
        await clientServer.matrixDb.insert('user_threepid_id_server', {
          address: 'testuser@example.com',
          medium: 'email',
          user_id: '@testuser:example.com',
          id_server: 'matrix.example.com'
        })

        await clientServer.matrixDb.insert('user_threepids', {
          address: 'testuser@example.com',
          medium: 'email',
          user_id: '@testuser:example.com',
          validated_at: epoch(),
          added_at: epoch()
        })

        const mockResolveResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              email: 'dwho@example.com',
              'm.server': 'matrix.example.com:8448'
            })
        })

        const mockRegisterResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              token: 'validToken'
            })
        })
        const mockUnbindResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              address: 'testuser@example.com',
              medium: 'email'
            })
        })
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockResolveResponse)
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockRegisterResponse)
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockUnbindResponse)

        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/delete')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            medium: 'email',
            address: 'testuser@example.com'
          })
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty(
          'id_server_unbind_result',
          'success'
        )

        // added this user so as not to mess up future tests if validToken is used again
        await clientServer.matrixDb.insert('user_threepids', {
          address: 'testuser@example.com',
          medium: 'email',
          user_id: '@testuser:example.com',
          validated_at: epoch(),
          added_at: epoch()
        })
      })
      it('should return an error if the user was not previously bound to any id server', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/delete')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            medium: 'email',
            address: 'testuser@example.com'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty(
          'id_server_unbind_result',
          'no-support'
        )
      })
      it('should return an error if the unbind was unsuccessful on the id-server', async () => {
        const mockResolveResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              email: 'dwho@example.com',
              'm.server': 'matrix.example.com:8448'
            })
        })

        const mockRegisterResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              token: 'validToken'
            })
        })
        const mockUnbindResponse = Promise.resolve({
          ok: false,
          status: 403,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              error: 'invalid session ID or client_secret',
              errcode: 'M_INVALID_PARAM'
            })
        })

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockResolveResponse)
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockRegisterResponse)
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockUnbindResponse)

        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/delete')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            medium: 'email',
            address: 'testuser@example.com',
            id_server: 'matrix.example.com'
          })
        expect(response.statusCode).toBe(403)
        expect(response.body).toHaveProperty(
          'id_server_unbind_result',
          'no-support'
        )
      })
    })

    describe('/_matrix/client/v3/account/3pid/bind', () => {
      it('should return 200 on a successful bind', async () => {
        const mockResolveResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              email: 'dwho@example.com',
              'm.server': 'matrix.example.com:8448'
            })
        })

        const mockBindResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              medium: 'email',
              address: 'localhost@example.com',
              mxid: '@testuser:example.com',
              not_after: 1234567890,
              not_before: 1234567890,
              signatures: {},
              ts: 1234567890
            })
        })

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockResolveResponse)

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockBindResponse)

        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/bind')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            client_secret: 'mysecret',
            id_access_token: 'myaccesstoken',
            id_server: 'matrix.example.com',
            sid: 'mysid'
          })

        expect(response.statusCode).toBe(200)
      })

      it('should return an error if bind fails', async () => {
        const mockResolveResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              email: 'dwho@example.com',
              'm.server': 'matrix.example.com:8448'
            })
        })

        const mockBindResponse = Promise.resolve({
          ok: false,
          status: 400,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              errcode: 'M_SESSION_NOT_VALIDATED',
              error: 'This validation session has not yet been completed'
            })
        })

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockResolveResponse)

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockBindResponse)

        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/bind')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            client_secret: 'mysecret',
            id_access_token: 'myaccesstoken',
            id_server: 'matrix.example.com',
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
      it('should return a 400 error if the medium is incorrect', async () => {
        const mockResolveResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              email: 'dwho@example.com',
              'm.server': 'matrix.example.com:8448'
            })
        })

        const mockBindResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              medium: 'wrongmedium',
              address: 'localhost@example.com',
              mxid: '@testuser:example.com',
              not_after: 1234567890,
              not_before: 1234567890,
              signatures: {},
              ts: 1234567890
            })
        })

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockResolveResponse)

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockBindResponse)

        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/bind')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            client_secret: 'mysecret',
            id_access_token: 'myaccesstoken',
            id_server: 'matrix.example.com',
            sid: 'mysid'
          })

        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty(
          'error',
          'Medium must be one of "email" or "msisdn"'
        )
      })
      it('should return a 400 error if the email is incorrect', async () => {
        const mockResolveResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              email: 'dwho@example.com',
              'm.server': 'matrix.example.com:8448'
            })
        })

        const mockBindResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              medium: 'email',
              address: '05934903',
              mxid: '@testuser:example.com',
              not_after: 1234567890,
              not_before: 1234567890,
              signatures: {},
              ts: 1234567890
            })
        })

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockResolveResponse)

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockBindResponse)

        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/bind')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            client_secret: 'mysecret',
            id_access_token: 'myaccesstoken',
            id_server: 'matrix.example.com',
            sid: 'mysid'
          })

        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid email')
      })
      it('should return a 400 error if the phone number is incorrect', async () => {
        const mockResolveResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              email: 'dwho@example.com',
              'm.server': 'matrix.example.com:8448'
            })
        })

        const mockBindResponse = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              medium: 'msisdn',
              address: 'localhost@example.com',
              mxid: '@testuser:example.com',
              not_after: 1234567890,
              not_before: 1234567890,
              signatures: {},
              ts: 1234567890
            })
        })

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockResolveResponse)

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockBindResponse)

        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/bind')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            client_secret: 'mysecret',
            id_access_token: 'myaccesstoken',
            id_server: 'matrix.example.com',
            sid: 'mysid'
          })

        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid phone number')
      })
      it('should return 403 if the user is not an admin and the server does not allow it', async () => {
        clientServer.conf.capabilities.enable_3pid_changes = false
        const response = await request(app)
          .post('/_matrix/client/v3/account/3pid/bind')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            client_secret: 'mysecret',
            id_access_token: 'myaccesstoken',
            id_server: 'matrix.example.com',
            sid: 'mysid'
          })

        expect(response.statusCode).toBe(403)
        expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
        expect(response.body).toHaveProperty(
          'error',
          'Cannot bind 3pid to user account as it is not allowed by server'
        )
        delete clientServer.conf.capabilities.enable_3pid_changes
      })
    })
  })
})
