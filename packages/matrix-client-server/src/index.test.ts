import fs from 'fs'
import ClientServer from './index'
import { AuthenticationTypes, type Config } from './types'
import buildMatrixDb from './__testData__/buildUserDB'
import defaultConfig from './__testData__/registerConf.json'

jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

// process.env.TWAKE_CLIENT_SERVER_CONF = '../../matrix-identity-server/src/__testData__/registerConf.json'

let conf: Config
let clientServer: ClientServer

beforeAll((done) => {
  conf = {
    ...defaultConfig,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
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
  buildMatrixDb(conf)
    .then(() => {
      done()
    })
    .catch((e) => {
      done(e)
    })
})

afterAll(() => {
  fs.unlinkSync('src/__testData__/test.db')
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
