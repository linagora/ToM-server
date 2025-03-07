import { Hash, supportedHashes } from '@twake/crypto'
import express from 'express'
import fs from 'fs'
import fetch from 'node-fetch'
import path from 'path'
import request from 'supertest'
import TwakeServer from '..'
import JEST_PROCESS_ROOT_PATH from '../../jest.globals'
import { type Config } from '../types'
import buildUserDB from './__testData__/buildUserDB'
import defaultConfig from './__testData__/registerConf.json'

jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

const pathToTestDataFolder = path.join(
  JEST_PROCESS_ROOT_PATH,
  'src',
  'identity-server',
  '__testData__'
)

const db = path.join(pathToTestDataFolder, 'test-cache.db')
const userDb = path.join(pathToTestDataFolder, 'users-cache.test.db')
const matrixDb = path.join(pathToTestDataFolder, 'test.matrix-cache.db')

process.env.TWAKE_IDENTITY_SERVER_CONF = path.join(
  pathToTestDataFolder,
  'registerConf.json'
)

let twakeServer: TwakeServer
let app: express.Application
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let federatedIdentityToken: string

beforeAll(async () => {
  const conf: Config = {
    ...defaultConfig,
    cache_engine: 'memory',
    database_engine: 'sqlite',
    database_host: db,
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    userdb_host: userDb,
    matrix_database_engine: 'sqlite',
    matrix_database_host: matrixDb,
    sms_api_key: '',
    sms_api_login: '',
    sms_api_url: '',
    auth_url: 'https://auth.example.com',
    matrix_admin_login: 'admin',
    matrix_admin_password: 'change-me',
    admin_access_token: 'secret'
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
  await buildUserDB(conf)

  twakeServer = new TwakeServer(conf)

  app = express()

  await twakeServer.ready

  app.use(twakeServer.endpoints)
})

beforeEach(() => {
  jest.mock('node-fetch', () => jest.fn())
  jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockImplementation(() => ({
      sendMail: sendMailMock
    }))
  }))
})

afterEach(() => {
  jest.clearAllMocks()
})

afterAll(() => {
  if (process.env.TEST_PG !== 'yes') {
    fs.unlinkSync(db)
    fs.unlinkSync(userDb)
    fs.unlinkSync(matrixDb)
  }

  twakeServer?.cleanJobs()
})

describe('Using Matrix Token', () => {
  const validToken = 'syt_ZHdobw_FakeTokenFromMatrixV_25Unpr'

  describe('/_matrix/identity/v2/lookup', () => {
    // @ts-expect-error mock is unknown
    fetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: () => {
        return {
          user_id: 'dwho'
        }
      }
    }))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let pepper = ''
    describe('/_matrix/identity/v2/hash_details', () => {
      it('should display algorithms and pepper', async () => {
        await twakeServer.idServer.cronTasks?.ready
        const response = await request(app)
          .get('/_matrix/identity/v2/hash_details')
          .query({ access_token: validToken })
          // .set('Authorization', `Bearer ${validToken}`)
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
        await twakeServer.idServer.cronTasks?.ready
        const phoneHash = hash.sha256(`33612345678 msisdn ${pepper}`)
        const response = await request(app)
          .post('/_matrix/identity/v2/lookup')
          .send({
            addresses: [phoneHash],
            algorithm: 'sha256',
            pepper
          })
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')

        expect(response.statusCode).toBe(200)
        expect(response.body.mappings[phoneHash]).toBe('@dwho:example.com')
      })
    })
  })

  describe('/_twake/identity/v1/lookup/match', () => {
    it('should find user with partial value', async () => {
      const response = await request(app)
        .post('/_twake/identity/v1/lookup/match')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Accept', 'application/json')
        .send({
          scope: ['uid'],
          fields: ['uid'],
          val: 'who'
        })
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        matches: [{ uid: 'dwho', address: '@dwho:example.com' }],
        inactive_matches: []
      })
    })

    it('should find user when searching by matrix address', async () => {
      const response = await request(app)
        .post('/_twake/identity/v1/lookup/match')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Accept', 'application/json')
        .send({
          scope: ['matrixAddress'],
          fields: ['sn'],
          val: '@dwho:example.com'
        })
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        matches: [{ uid: 'dwho', address: '@dwho:example.com', sn: 'Dwho' }],
        inactive_matches: []
      })
    })

    it('should respect limit', async () => {
      const response = await request(app)
        .post('/_twake/identity/v1/lookup/match')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Accept', 'application/json')
        .send({
          scope: ['uid'],
          fields: ['uid'],
          val: 'user',
          limit: 4
        })
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        matches: [],
        inactive_matches: [
          { uid: 'user00', address: '@user00:example.com' },
          { uid: 'user01', address: '@user01:example.com' },
          { uid: 'user02', address: '@user02:example.com' },
          { uid: 'user03', address: '@user03:example.com' }
        ]
      })
    })

    it('should respect limit and offset', async () => {
      const response = await request(app)
        .post('/_twake/identity/v1/lookup/match')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Accept', 'application/json')
        .send({
          scope: ['uid'],
          fields: ['uid'],
          val: 'user',
          limit: 4,
          offset: 3
        })
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        matches: [],
        inactive_matches: [
          { uid: 'user03', address: '@user03:example.com' },
          { uid: 'user04', address: '@user04:example.com' },
          { uid: 'user05', address: '@user05:example.com' },
          { uid: 'user06', address: '@user06:example.com' }
        ]
      })
    })
  })
})

/*
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
    federatedIdentityToken = response.body.token
  })
})

describe('/_matrix/identity/v2/account', () => {
  it('should logout (/_matrix/identity/v2/account/logout)', async () => {
    let response = await request(app)
      .post('/_matrix/identity/v2/account/logout')
      .set('Authorization', `Bearer ${federatedIdentityToken}`)
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(200)
    response = await request(app)
      .get('/_matrix/identity/v2/account')
      .set('Authorization', `Bearer ${federatedIdentityToken}`)
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(401)
  })
})
*/
