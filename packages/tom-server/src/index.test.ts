import defaultConfig from './identity-server/__testData__/registerConf.json'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import { type Config } from './utils'
import buildUserDB from './identity-server/__testData__/buildUserDB'
import TwakeServer from './index'

const testDb = './global.db'

let idServer: TwakeServer
let app: express.Application

beforeAll((done) => {
  const conf: Config = {
    ...defaultConfig,
    database_engine: 'sqlite',
    database_host: testDb,
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    template_dir: './src/identity-server/templates'
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
      idServer = new TwakeServer(conf)
      app = express()

      idServer.ready
        .then(() => {
          app.use(idServer.endpoints)
          done()
        })
        .catch((e) => {
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
  }
})

test('/.well-known/matrix/client', async () => {
  const response = await request(app).get('/.well-known/matrix/client')
  expect(response.statusCode).toBe(200)
  expect(response.body).toEqual({
    domain: 'matrix.org',
    'm.homeserver': { base_url: 'localhost' },
    'm.identity_server': { base_url: 'http://example.com/' },
    't.server': { base_url: 'http://example.com/' }
  })
})
