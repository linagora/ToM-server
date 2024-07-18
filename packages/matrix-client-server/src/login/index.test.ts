import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../index'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import { type Config } from '../types'
import defaultConfig from '../__testData__/loginConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'

process.env.TWAKE_CLIENT_SERVER_CONF = './src/__testData__/loginConf.json'
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
  fs.unlinkSync('src/__testData__/testLogin.db')
  fs.unlinkSync('src/__testData__/testMatrixLogin.db')
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
  describe('/_matrix/client/v3/login', () => {
    it('should return the login flows', async () => {
      const response = await request(app).get('/_matrix/client/v3/login')
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('flows')
      expect(response.body.flows).toEqual([
        { type: 'm.login.password' },
        { get_login_token: true, type: 'm.login.token' }
      ])
    })
  })
  //   let validToken: string
  //   describe('Endpoints with authentication', () => {
  //     beforeAll(async () => {
  //       validToken = randomString(64)
  //       try {
  //         await clientServer.matrixDb.insert('user_ips', {
  //           user_id: '@testuser:example.com',
  //           device_id: 'testdevice',
  //           access_token: validToken,
  //           ip: '127.0.0.1',
  //           user_agent: 'curl/7.31.0-DEV',
  //           last_seen: 1411996332123
  //         })
  //       } catch (e) {
  //         logger.error('Error creating tokens for authentification', e)
  //       }
  //     })
  //   })
})
