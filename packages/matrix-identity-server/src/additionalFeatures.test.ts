import { Hash, supportedHashes } from '@twake/crypto'
import express from 'express'
import fs from 'fs'
import fetch from 'node-fetch'
import sqlite3 from 'sqlite3'
import request from 'supertest'
import buildUserDB, { buildMatrixDb } from './__testData__/buildUserDB'
import defaultConfig from './__testData__/registerConf.json'
import updateUsers from './cron/updateUsers'
import IdServer from './index'
import { type Config } from './types'
import type UserDBSQLite from './userdb/sql/sqlite'

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
beforeAll((done) => {
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
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      json: () =>
        Promise.resolve({
          sub: '@dwho:example.com',
          'm.server': 'matrix.example.com:8448'
        })
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
      const dwhoPhone = hash.sha256(`33612345678 msisdn ${pepper}`)
      const rtylerPhone = hash.sha256(`33687654321 msisdn ${pepper}`)
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

    it('should detect new users', (done) => {
      const hash = new Hash()
      Promise.all([hash.ready, idServer.cronTasks?.ready])
        .then(() => {
          ;(idServer.userDB.db as UserDBSQLite).db?.run(
            "INSERT INTO users VALUES('okenobi', '2301234567', 'okenobi@company.com')",
            (err) => {
              // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
              if (err) {
                done(err)
              } else {
                updateUsers(conf, idServer.db, idServer.userDB, idServer.logger)
                  .then(() => {
                    void idServer.db.getAll('hashes', ['*']).catch(done)
                    const okenobiPhone = hash.sha256(
                      `2301234567 msisdn ${pepper}`
                    )
                    const okenobiMail = hash.sha256(
                      `okenobi@company.com email ${pepper}`
                    )
                    const res: Record<string, string> = {}
                    res[okenobiPhone] = res[okenobiMail] = '@okenobi:matrix.org'
                    request(app)
                      .post('/_matrix/identity/v2/lookup')
                      .send({
                        addresses: [okenobiMail, okenobiPhone],
                        algorithm: 'sha256',
                        pepper
                      })
                      .set('Authorization', `Bearer ${validToken}`)
                      .set('Accept', 'application/json')
                      .then((response) => {
                        expect(response.statusCode).toBe(200)
                        expect(response.body).toEqual({
                          inactive_mappings: res,
                          mappings: {}
                        })
                        done()
                      })
                      .catch(done)
                  })
                  .catch(done)
              }
            }
          )
        })
        .catch(done)
    })

    it('should detect new active user', (done) => {
      const hash = new Hash()
      Promise.all([
        hash.ready,
        idServer.cronTasks?.ready,
        (idServer.userDB.db as UserDBSQLite).db?.run(
          "DELETE FROM users WHERE uid='dwho'"
        )
      ])
        .then(() => {
          const matrixDb = new sqlite3.Database(
            conf.matrix_database_host as string
          )
          matrixDb.run(
            "INSERT INTO users VALUES('@rtyler:company.com')",
            (err) => {
              // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
              if (err) {
                done(err)
              } else {
                const rtylerPhone = hash.sha256(`33687654321 msisdn ${pepper}`)
                updateUsers(conf, idServer.db, idServer.userDB, idServer.logger)
                  .then(() => {
                    request(app)
                      .post('/_matrix/identity/v2/lookup')
                      .send({
                        addresses: [rtylerPhone],
                        algorithm: 'sha256',
                        pepper
                      })
                      .set('Authorization', `Bearer ${validToken}`)
                      .set('Accept', 'application/json')
                      .then((response) => {
                        expect(response.status).toBe(200)
                        expect(response.body.mappings[rtylerPhone]).toBe(
                          '@rtyler:matrix.org'
                        )
                        done()
                      })
                      .catch(done)
                  })
                  .catch(done)
              }
            }
          )
        })
        .catch(done)
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
