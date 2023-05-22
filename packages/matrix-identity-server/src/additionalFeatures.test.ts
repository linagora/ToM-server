import express from 'express'
import request from 'supertest'
import IdServer from './index'
import { type Config } from './types'
import fs from 'fs'
import fetch from 'node-fetch'
import { Hash, supportedHashes } from '@twake/crypto'
import defaultConfig from './__testData__/registerConf.json'
import buildUserDB, { buildMatrixDb } from './__testData__/buildUserDB'

jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

process.env.TWAKE_IDENTITY_SERVER_CONF = './src/__testData__/registerConf.json'

let idServer: IdServer
let app: express.Application
let validToken: string

beforeAll((done) => {
  const conf: Config = {
    ...defaultConfig,
    additional_features: true,
    database_engine: 'sqlite',
    database_host: 'src/__testData__/add.db',
    base_url: 'http://example.com/',
    matrix_database_engine: 'sqlite',
    matrix_database_host: 'src/__testData__/matrix.db',
    userdb_engine: 'sqlite',
    userdb_host: 'src/__testData__/add.db'
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
          idServer = new IdServer(conf)
          app = express()

          idServer.ready
            .then(() => {
              Object.keys(idServer.api.get).forEach((k) => {
                app.get(k, idServer.api.get[k])
              })
              Object.keys(idServer.api.post).forEach((k) => {
                app.post(k, idServer.api.post[k])
              })
              done()
            })
            .catch(done)
        })
        .catch(done)
    })
    .catch(done)
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.mock('node-fetch', () => jest.fn())
  jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockImplementation(() => ({
      sendMail: sendMailMock
    }))
  }))
})

afterAll(() => {
  fs.unlinkSync('src/__testData__/add.db')
  fs.unlinkSync('src/__testData__/matrix.db')
  idServer.cleanJobs()
})

describe('/_matrix/identity/v2/account/register', () => {
  it('should accept valid request', async () => {
    const mockResponse = Promise.resolve({
      ok: true,
      status: 200,
      json: () => {
        return {
          sub: '@dwho:example.com'
        }
      }
    })
    // @ts-expect-error mock is unknown
    fetch.mockImplementation(async () => await mockResponse)
    await mockResponse
    const response = await request(app)
      .post('/_matrix/identity/v2/account/register')
      .send({
        access_token: 'bar',
        expires_in: 86400,
        matrix_server_name: 'matrix.example.com',
        token_type: 'Bearer'
      })
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(200)
    expect(response.body.token).toMatch(/^[a-zA-Z0-9]{64}$/)
    validToken = response.body.token
  })
})

describe('/_matrix/identity/v2/lookup', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let pepper = ''
  describe('/_matrix/identity/v2/hash_details', () => {
    it('should display algorithms and pepper', async () => {
      await idServer.cronTasks?.ready
      const response = await request(app)
        .get('/_matrix/identity/v2/hash_details')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Accept', 'application/json')
      expect(response.body).toHaveProperty('lookup_pepper')
      expect(response.statusCode).toBe(200)
      pepper = response.body.lookup_pepper
      expect(response.body.algorithms).toEqual(supportedHashes)
    })
  })

  describe('/_matrix/identity/v2/lookup', () => {
    it('should return Matrix id', async () => {
      const hash = new Hash()
      await hash.ready
      await idServer.cronTasks?.ready
      const dwhoPhone = hash.sha256(`33612345678 phone ${pepper}`)
      const rtylerPhone = hash.sha256(`33687654321 phone ${pepper}`)
      const response = await request(app)
        .post('/_matrix/identity/v2/lookup')
        .send({
          addresses: [dwhoPhone, rtylerPhone],
          algorithm: 'sha256',
          pepper
        })
        .set('Authorization', `Bearer ${validToken}`)
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(200)
      expect(response.body.mappings[dwhoPhone]).toBe('@dwho:matrix.org')
      expect(response.body.inactive_mappings[rtylerPhone]).toBe(
        '@rtyler:matrix.org'
      )
    })
  })
})

describe('/_matrix/identity/v2/account', () => {
  it('should logout (/_matrix/identity/v2/account/logout)', async () => {
    const response = await request(app)
      .post('/_matrix/identity/v2/account/logout')
      .set('Authorization', `Bearer ${validToken}`)
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(200)
  })
})
