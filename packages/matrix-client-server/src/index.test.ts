import express from 'express'
import fs from 'fs'
import request from 'supertest'
import ClientServer from './index'
import { AuthenticationTypes, type Config } from './types'
import { buildMatrixDb, buildUserDB } from './__testData__/buildUserDB'
import defaultConfig from './__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { randomString } from '@twake/crypto'

jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

process.env.TWAKE_CLIENT_SERVER_CONF = './src/__testData__/registerConf.json'

let clientServer: ClientServer
let app: express.Application
// let validToken: string
let conf: Config
const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  conf = {
    ...defaultConfig,
    cron_service: false,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    matrix_database_engine: 'sqlite',
    flows: [
      {
        stages: [AuthenticationTypes.Password, AuthenticationTypes.Dummy]
      },
      {
        stages: [AuthenticationTypes.Password, AuthenticationTypes.Email]
      }
    ],
    params: {
      'm.login.terms': {
        policies: {
          terms_of_service: {
            version: '1.2',
            en: {
              name: 'Terms of Service',
              url: 'https://example.org/somewhere/terms-1.2-en.html'
            },
            fr: {
              name: "Conditions d'utilisation",
              url: 'https://example.org/somewhere/terms-1.2-fr.html'
            }
          }
        }
      }
    }
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
  fs.unlinkSync('src/__testData__/test.db')
  fs.unlinkSync('src/__testData__/testMatrix.db')
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

describe('Error on server start', () => {
  process.env.HASHES_RATE_LIMIT = 'falsy_number'

  it('should display message error about hashes rate limit value', () => {
    expect(() => {
      clientServer = new ClientServer()
    }).toThrow(
      new Error(
        'hashes_rate_limit must be a number or a string representing a number'
      )
    )
    delete process.env.HASHES_RATE_LIMIT
  })
})

describe('Use configuration file', () => {
  beforeAll((done) => {
    clientServer = new ClientServer()
    app = express()
    console.log('clientServer.ready ?')
    clientServer.ready
      .then(() => {
        console.log('clientServer.ready !')
        Object.keys(clientServer.api.get).forEach((k) => {
          app.get(k, clientServer.api.get[k])
        })
        Object.keys(clientServer.api.post).forEach((k) => {
          app.post(k, clientServer.api.post[k])
        })
        Object.keys(clientServer.api.put).forEach((k) => {
          app.put(k, clientServer.api.put[k])
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

  test('Reject unimplemented endpoint with 404', async () => {
    const response = await request(app).get('/_matrix/unknown')
    expect(response.statusCode).toBe(404)
  })

  // test('Reject bad method with 405', async () => {
  //   const response = await request(app).post(
  //     '/_matrix/client/v3/profile/@testuser:example.com'
  //   )
  //   expect(response.statusCode).toBe(405)
  // })

  // test('/_matrix/identity/v2 (status)', async () => {
  //   const response = await request(app).get('/_matrix/identity/v2')
  //   expect(response.statusCode).toBe(200)
  // })

  // test('/_matrix/identity/versions', async () => {
  //   const response = await request(app).get('/_matrix/identity/versions')
  //   expect(response.statusCode).toBe(200)
  // })

  // test('/_matrix/identity/v2/terms', async () => {
  //   const response = await request(app).get('/_matrix/identity/v2/terms')
  //   expect(response.statusCode).toBe(200)
  // })

  // describe('Endpoints with authentication', () => {
  // })
})
describe('/_matrix/client/v3/account/whoami', () => {
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
})
