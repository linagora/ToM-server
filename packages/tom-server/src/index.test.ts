import defaultConfig from './identity-server/__testData__/registerConf.json'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import { type Config } from './types'
import buildUserDB from './identity-server/__testData__/buildUserDB'
import TwakeServer from './index'
import path from 'path'
import JEST_PROCESS_ROOT_PATH from '../jest.globals'

const testDb = path.join(JEST_PROCESS_ROOT_PATH, 'global.db')
const matrixTestDb = path.join(JEST_PROCESS_ROOT_PATH, 'matrix.global.db')

let idServer: TwakeServer
let app: express.Application

beforeAll((done) => {
  const conf: Config = {
    ...defaultConfig,
    database_engine: 'sqlite',
    database_host: testDb,
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    userdb_host: testDb,
    template_dir: path.join(
      JEST_PROCESS_ROOT_PATH,
      'src',
      'identity-server',
      'templates'
    ),
    matrix_database_engine: 'sqlite',
    matrix_database_host: matrixTestDb
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
  }
  buildUserDB(conf)
    .then(() => {
      idServer = new TwakeServer(conf)
      app = express()

      idServer.ready
        .then(() => {
          app.use(idServer.endpoints)
          done()
        })
        .catch((e) => {
          console.error('HERE')
          done(e)
        })
    })
    .catch((e) => {
      done(e)
    })
})

afterAll(() => {
  idServer.cleanJobs()
  if (process.env.TEST_PG !== 'yes') {
    fs.unlinkSync(testDb)
    fs.unlinkSync(matrixTestDb)
  }
})

test('/.well-known/matrix/client', async () => {
  const response = await request(app).get('/.well-known/matrix/client')
  expect(response.statusCode).toBe(200)
  expect(response.body).toEqual({
    domain: 'matrix.org',
    'm.homeserver': { base_url: 'localhost' },
    'm.identity_server': { base_url: 'http://example.com/' },
    'm.integrations': {
      jitsi: {
        baseUrl: 'https://jitsi.example.com/',
        preferredDomain: 'jitsi.example.com',
        useJwt: false
      }
    },
    't.server': { base_url: 'http://example.com/' }
  })
})
