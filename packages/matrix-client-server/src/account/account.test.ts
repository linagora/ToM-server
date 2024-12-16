import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../index'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import { type Config } from '../types'
import fetch from 'node-fetch'
import defaultConfig from '../__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import {
  setupTokens,
  validRefreshToken3,
  validToken,
  validToken3
} from '../__testData__/setupTokens'
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
    matrix_database_host: './src/__testData__/testMatrixAccount.db',
    database_host: './src/__testData__/testAccount.db',
    userdb_host: './src/__testData__/testAccount.db'
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
  fs.unlinkSync('src/__testData__/testAccount.db')
  fs.unlinkSync('src/__testData__/testMatrixAccount.db')
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
    describe('/_matrix/client/v3/account/whoami', () => {
      it('should refuse a request with a used access token', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/refresh')
          .send({ refresh_token: validRefreshToken3 })
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty('access_token')
        expect(response.body).toHaveProperty('refresh_token')
        const response1 = await request(app)
          .get('/_matrix/client/v3/account/whoami')
          .set('Authorization', `Bearer ${validToken3}`)
          .set('Accept', 'application/json')
        expect(response1.statusCode).toBe(401)
      })
    })
    describe('/_matrix/client/v3/account/whoami', () => {
      let asToken: string
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
    describe('/_matrix/client/v3/account/deactivate', () => {
      let session: string
      it('should refuse to deactivate an account if the server does not allow it', async () => {
        clientServer.conf.capabilities.enable_3pid_changes = false
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Accept', 'application/json')
          .send({})
        expect(response1.statusCode).toBe(401)
        expect(response1.body).toHaveProperty('session')
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
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
        clientServer.conf.capabilities.enable_3pid_changes = true
      })
      it('should refuse to erase all user data if the server does not allow it', async () => {
        clientServer.conf.capabilities.enable_set_avatar_url = false
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Accept', 'application/json')
          .send({})
        expect(response1.statusCode).toBe(401)
        expect(response1.body).toHaveProperty('session')
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            auth: {
              type: 'm.login.password',
              session,
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              identifier: { type: 'm.id.user', user: '@testuser:example.com' }
            },
            erase: true
          })
        expect(response.statusCode).toBe(403)
        expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
        expect(response.body).toHaveProperty(
          'error',
          'Cannot erase account as it is not allowed by server'
        )
        clientServer.conf.capabilities.enable_set_avatar_url = true
      })
      it('should refuse an invalid auth', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            auth: {
              type: 'm.login.password',
              session: 'session',
              password: 'wrongpassword',
              identifier: { type: 'wrongtype', user: '@testuser:example.com' }
            }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid auth')
      })
      it('should refuse an invalid id_server', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            id_server: 42
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid id_server')
      })
      it('should refuse an invalid erase', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            erase: 'true'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        expect(response.body).toHaveProperty('error', 'Invalid erase')
      })
      it('should deactivate a user account who authenticated with a token', async () => {
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({})
        expect(response1.statusCode).toBe(401)
        expect(response1.body).toHaveProperty('session')
        session = response1.body.session

        const response = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
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
      it('should deactivate a user account who authenticated without an access token', async () => {
        const accessToken = randomString(64)
        const hash = new Hash()
        await hash.ready

        // Setup the database with the user to deactivate's information
        await clientServer.matrixDb.insert('users', {
          name: '@usertodeactivate:example.com',
          password_hash: hash.sha256('password')
        })

        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@usertodeactivate:example.com',
          device_id: 'devicetoremove',
          access_token: accessToken,
          ip: '137.0.0.1',
          user_agent: 'curl/7.31.0-DEV',
          last_seen: 1411996332123
        })
        await clientServer.matrixDb.insert('access_tokens', {
          id: randomString(64),
          user_id: '@usertodeactivate:example.com',
          device_id: 'devicetodeactivate',
          token: accessToken
        })
        await clientServer.matrixDb.insert('user_threepids', {
          user_id: '@usertodeactivate:example.com',
          medium: 'email',
          address: 'usertodeactivate@example.com',
          validated_at: epoch(),
          added_at: epoch()
        })
        await clientServer.matrixDb.insert('user_threepids', {
          user_id: '@usertodeactivate:example.com',
          medium: 'msisdn',
          address: '0678912765',
          validated_at: epoch(),
          added_at: epoch()
        })
        await clientServer.matrixDb.insert('devices', {
          user_id: '@usertodeactivate:example.com',
          device_id: 'devicetodeactivate'
        })
        await clientServer.matrixDb.insert('pushers', {
          id: randomString(64),
          user_name: '@usertodeactivate:example.com',
          access_token: accessToken,
          profile_tag: 'profile_tag',
          kind: 'user',
          app_id: 'app_id',
          app_display_name: 'app_display_name',
          device_display_name: 'device_display_name',
          pushkey: 'pushkey',
          ts: epoch()
        })
        await clientServer.matrixDb.insert('current_state_events', {
          event_id: '$eventid:example.com',
          room_id: '!roomid:example.com',
          type: 'm.room.member',
          state_key: '@usertodeactivate:example.com',
          membership: 'join'
        })
        await clientServer.matrixDb.insert('events', {
          stream_ordering: 0,
          topological_ordering: 0,
          event_id: '$eventid:example.com',
          room_id: '!roomid:example.com',
          type: 'm.room.member',
          state_key: '@usertodeactivate:example.com',
          content: '{"random_key": "random_value"}',
          processed: 0,
          outlier: 0,
          depth: 1,
          sender: '@sender:example.com',
          origin_server_ts: 1411996332123
        })
        await clientServer.matrixDb.insert('room_memberships', {
          user_id: '@usertodeactivate:example.com',
          room_id: '!roomid:example.com',
          membership: 'join',
          event_id: '$eventid:example.com',
          sender: '@sender:example.com'
        })

        // Mock the response of the identity server from the delete3pid function for the first 3pid

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
              address: 'usertodeactivate@example.com',
              medium: 'email'
            })
        })

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockResolveResponse)
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockRegisterResponse)
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockUnbindResponse)

        // Mock the response of the identity server from the delete3pid function for the second 3pid

        const mockResolveResponse2 = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              email: 'dwho@example.com',
              'm.server': 'matrix.example.com:8448'
            })
        })

        const mockRegisterResponse2 = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              token: 'validToken'
            })
        })

        const mockUnbindResponse2 = Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          json: () =>
            Promise.resolve({
              address: '0678912765',
              medium: 'msisdn'
            })
        })

        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockResolveResponse2)
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockRegisterResponse2)
        // @ts-expect-error mock is unknown
        fetch.mockImplementationOnce(async () => await mockUnbindResponse2)

        const response1 = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Accept', 'application/json')
          .send({})
        expect(response1.statusCode).toBe(401)
        expect(response1.body).toHaveProperty('session')
        session = response1.body.session

        const response = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Accept', 'application/json')
          .send({
            auth: {
              type: 'm.login.password',
              session,
              password: 'password',
              identifier: {
                type: 'm.id.user',
                user: '@usertodeactivate:example.com'
              }
            },
            erase: true,
            id_server: 'matrix.example.com'
          })
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty(
          'id_server_unbind_result',
          'success'
        )
      })
      it('should refuse to deactivate an account that was already deactivated', async () => {
        const response1 = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Accept', 'application/json')
          .send({})
        expect(response1.statusCode).toBe(401)
        expect(response1.body).toHaveProperty('session')
        session = response1.body.session

        const response = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Accept', 'application/json')
          .send({
            auth: {
              type: 'm.login.password',
              session,
              password: 'password',
              identifier: {
                type: 'm.id.user',
                user: '@usertodeactivate:example.com'
              }
            },
            erase: true,
            id_server: 'matrix.example.com'
          })
        expect(response.statusCode).toBe(401)
        expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
        expect(response.body).toHaveProperty(
          'error',
          'The user does not have a password registered or the provided password is wrong.'
        ) // Error from UI Authentication since the password was deleted upon deactivation of the account
      })
      it('should send a no-support response if the identity server did not unbind the 3pid association', async () => {
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

        const response1 = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Accept', 'application/json')
          .send({})
        expect(response1.statusCode).toBe(401)
        expect(response1.body).toHaveProperty('session')
        session = response1.body.session
        const hash = new Hash()
        await hash.ready
        await clientServer.matrixDb.insert('users', {
          name: '@newusertodeactivate:example.com',
          password_hash: hash.sha256('password')
        })
        await clientServer.matrixDb.insert('user_threepids', {
          user_id: '@newusertodeactivate:example.com',
          medium: 'email',
          address: 'newusertodeactivate@example.com',
          validated_at: epoch(),
          added_at: epoch()
        })
        const response = await request(app)
          .post('/_matrix/client/v3/account/deactivate')
          .set('Accept', 'application/json')
          .send({
            auth: {
              type: 'm.login.password',
              session,
              password: 'password',
              identifier: {
                type: 'm.id.user',
                user: '@newusertodeactivate:example.com'
              }
            },
            erase: true,
            id_server: 'matrix.example.com'
          })
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty(
          'id_server_unbind_result',
          'no-support'
        )
      })
    })
  })
})
