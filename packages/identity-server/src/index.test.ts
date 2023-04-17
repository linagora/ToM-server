import express from 'express'
import request from 'supertest'
import IdServer, { type Config } from './index'
import fs from 'fs'
import fetch from 'node-fetch'
import { Hash, supportedHashes } from '@twake/crypto'
import defaultConfig from './__testData__/registerConf.json'
import buildUserDB from './__testData__/buildUserDB'

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let federationToken: string

beforeAll((done) => {
  const conf: Config = {
    ...defaultConfig,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite'
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
      idServer = new IdServer()
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
        .catch((e) => {
          done(e)
        })
    })
    .catch((e) => {
      done(e)
    })
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
  if (process.env.TEST_PG !== 'yes') fs.unlinkSync('src/__testData__/test.db')
  idServer.cleanJobs()
})

describe('Using Matrix Token', () => {
  const validToken = 'syt_ZHdobw_FakeTokenFromMatrixV_25Unpr'

  it('should require authentication', async () => {
    await idServer.cronTasks?.ready
    const response = await request(app)
      .get('/_matrix/identity/v2/hash_details')
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(401)
  })

  describe('/_matrix/identity/v2/lookup', () => {
    const mockResponse = Promise.resolve({
      ok: true,
      status: 200,
      json: () => {
        return {
          user_id: 'dwho'
        }
      }
    })
    // @ts-expect-error mock is unknown
    fetch.mockImplementation(async () => await mockResponse)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let pepper = ''
    describe('/_matrix/identity/v2/hash_details', () => {
      it('should display algorithms and pepper', async () => {
        await idServer.cronTasks?.ready
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
        await idServer.cronTasks?.ready
        const phoneHash = hash.sha256(`33612345678 phone ${pepper}`)
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
        expect(response.body.mappings[phoneHash]).toBe('@dwho:matrix.org')
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
      expect(response.body).toEqual({ matches: [{ uid: 'dwho' }] })
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
    federationToken = response.body.token
  })
})

describe('/_matrix/identity/v2/account', () => {
  it('should logout (/_matrix/identity/v2/account/logout)', async () => {
    let response = await request(app)
      .post('/_matrix/identity/v2/account/logout')
      .set('Authorization', `Bearer ${federationToken}`)
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(200)
    response = await request(app)
      .get('/_matrix/identity/v2/account')
      .set('Authorization', `Bearer ${federationToken}`)
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(401)
  })
})
*/
