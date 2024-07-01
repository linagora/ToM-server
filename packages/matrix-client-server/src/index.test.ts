import fs from 'fs'
import ClientServer from './index'
import { type Config } from './types'
import buildMatrixDb from './__testData__/buildUserDB'
import defaultConfig from './__testData__/registerConf.json'

jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

process.env.TWAKE_CLIENT_SERVER_CONF = './src/__testData__/registerConf.json'

let conf: Config
let clientServer: ClientServer

beforeAll((done) => {
  conf = {
    ...defaultConfig,
    database_engine: 'sqlite',
    base_url: '',
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
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  afterAll(() => {
    clientServer.cleanJobs()
  })

  describe('Endpoint with authentication', () => {
    it('should reject if more than 100 requests are done in less than 10 seconds', async () => {
      let response
      let token
      // eslint-disable-next-line @typescript-eslint/no-for-in-array, @typescript-eslint/no-unused-vars
      for (const i in [...Array(101).keys()]) {
        token = Number(i) % 2 === 0 ? `Bearer ${validToken}` : 'falsy_token'
        response = await request(app)
          .get('/_matrix/client/v3/account/whoami')
          .set('Authorization', token)
          .set('Accept', 'application/json')
      }
      expect((response as Response).statusCode).toEqual(429)
      await new Promise((resolve) => setTimeout(resolve, 11000))
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
  })
})
