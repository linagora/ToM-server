import express from 'express'
import fs from 'fs'
import path from 'path'
import request from 'supertest'
import JEST_PROCESS_ROOT_PATH from '../jest.globals'
import buildUserDB from './identity-server/__testData__/buildUserDB'
import defaultConfig from './identity-server/__testData__/registerConf.json'
import TwakeServer from './index'
import { type Config } from './types'

const testDb = path.join(JEST_PROCESS_ROOT_PATH, 'global.db')
const userDb = path.join(JEST_PROCESS_ROOT_PATH, 'users.db')
const matrixTestDb = path.join(JEST_PROCESS_ROOT_PATH, 'matrix.global.db')

describe('Tom-server', () => {
  let idServer: TwakeServer
  let app: express.Application

  const setEnvironment = (
    done: jest.DoneCallback,
    enableCompanyFeatures: boolean,
    recreateMatrixDb = false
  ): void => {
    const conf: Config = {
      ...defaultConfig,
      additional_features: enableCompanyFeatures,
      base_url: 'http://example.com/',
      database_engine: 'sqlite',
      database_host: testDb,
      matrix_database_engine: 'sqlite',
      matrix_database_host: matrixTestDb,
      oidc_issuer: 'https://auth.example.com',
      userdb_engine: 'sqlite',
      userdb_host: userDb,
      sms_api_key: '',
      sms_api_login: '',
      sms_api_url: ''
    }
    if (process.env.TEST_PG === 'yes') {
      conf.database_engine = 'pg'
      conf.userdb_engine = 'pg'
      conf.database_host = process.env.PG_HOST ?? 'localhost'
      conf.database_user = process.env.PG_USER ?? 'twake'
      conf.database_password = process.env.PG_PASSWORD ?? 'twake'
      conf.database_name = process.env.PG_DATABASE ?? 'test'
      conf.matrix_database_engine = 'pg'
      conf.matrix_database_host = process.env.PG_HOST ?? 'localhost'
      conf.matrix_database_user = process.env.PG_USER ?? 'twake'
      conf.matrix_database_password = process.env.PG_PASSWORD ?? 'twake'
      conf.matrix_database_name = process.env.PG_DATABASE ?? 'test'
      conf.userdb_host = process.env.PG_HOST ?? 'localhost'
      conf.userdb_user = process.env.PG_USER ?? 'twake'
      conf.userdb_password = process.env.PG_PASSWORD ?? 'twake'
      conf.userdb_name = process.env.PG_DATABASE ?? 'test'
    }
    buildUserDB(conf, recreateMatrixDb)
      .then(() => {
        idServer = new TwakeServer(conf)
        app = express()

        idServer.ready
          .then(() => {
            app.use(idServer.endpoints)
            done()
          })
          .catch((e) => {
            console.error('Error', e)
            done(e)
          })
      })
      .catch((e) => {
        done(e)
      })
  }

  const cleanEnvironment = (idServer: TwakeServer): void => {
    if (process.env.TEST_PG !== 'yes') {
      fs.unlinkSync(testDb)
      fs.unlinkSync(userDb)
      fs.unlinkSync(matrixTestDb)
    }
    idServer.cleanJobs()
  }

  describe('Enterprise version', () => {
    beforeAll((done) => {
      setEnvironment(done, true)
    })

    afterAll(() => {
      cleanEnvironment(idServer)
    })

    test('/.well-known/matrix/client', async () => {
      const response = await request(app).get('/.well-known/matrix/client')
      expect(response.statusCode).toBe(200)
      expect(response.body).toEqual({
        'm.homeserver': { base_url: 'https://localhost/' },
        'm.identity_server': { base_url: 'http://example.com/' },
        'm.integrations': {
          jitsi: {
            baseUrl: 'https://jitsi.example.com/',
            preferredDomain: 'jitsi.example.com',
            useJwt: false
          }
        },
        'm.authentication': {
          issuer: 'https://auth.example.com'
        },
        'org.matrix.msc3575.proxy': {
          url: 'https://syncv3.example.com'
        },
        't.server': {
          base_url: 'http://example.com/',
          server_name: 'example.com'
        }
      })
    })
  })

  describe('Public version', () => {
    beforeAll((done) => {
      setEnvironment(done, false, true)
    })

    afterAll(() => {
      cleanEnvironment(idServer)
    })

    describe('Identity server', () => {
      test('company features endpoint should not be available', async () => {
        let response = await request(app).get(
          '/_twake/identity/v1/lookup/match'
        )
        expect(response.statusCode).toBe(404)

        response = await request(app).get('/_twake/identity/v1/lookup/diff')
        expect(response.statusCode).toBe(404)
      })
    })

    describe('Administration Console API', () => {
      test('administration console endpoint should not be available', async () => {
        const response = await request(app).post('/_twake/app/v1/rooms')
        expect(response.statusCode).toBe(404)
      })
    })
  })
})
