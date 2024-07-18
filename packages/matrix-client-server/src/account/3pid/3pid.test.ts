import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../../index'
import fetch from 'node-fetch'
import { buildMatrixDb, buildUserDB } from '../../__testData__/buildUserDB'
import { type Config } from '../../types'
import defaultConfig from '../../__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { randomString } from '@twake/crypto'

process.env.TWAKE_CLIENT_SERVER_CONF = './src/__testData__/registerConf.json'
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
    database_host: './src/__testData__/testThreepid.db',
    matrix_database_host: './src/__testData__/testMatrixThreepid.db',
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
      } catch (e) {
        logger.error('Error creating tokens for authentification', e)
      }
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
