import { Hash, randomString, supportedHashes } from '@twake/crypto'
import express from 'express'
import fs from 'fs'
import fetch from 'node-fetch'
import querystring from 'querystring'
import request, { type Response } from 'supertest'
import buildUserDB from './__testData__/buildUserDB'
import defaultConfig from './__testData__/registerConf.json'
import IdServer from './index'
import { type Config } from './types'

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
let conf: Config
let longKeyPair: { publicKey: string; privateKey: string; keyId: string }
let shortKeyPair: { publicKey: string; privateKey: string; keyId: string }

beforeAll((done) => {
  conf = {
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
      idServer = new IdServer()
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

  afterAll(() => {
    idServer.cleanJobs()
  })

  test('Reject unimplemented endpoint with 404', async () => {
    const response = await request(app).get('/_matrix/unknown')
    expect(response.statusCode).toBe(404)
  })

  test('Reject bad method with 405', async () => {
    const response = await request(app).get(
      '/_matrix/identity/v2/account/register'
    )
    expect(response.statusCode).toBe(405)
  })

  test('/_matrix/identity/v2 (status)', async () => {
    const response = await request(app).get('/_matrix/identity/v2')
    expect(response.statusCode).toBe(200)
  })

  test('/_matrix/identity/versions', async () => {
    const response = await request(app).get('/_matrix/identity/versions')
    expect(response.statusCode).toBe(200)
  })

  test('/_matrix/identity/v2/terms', async () => {
    const response = await request(app).get('/_matrix/identity/v2/terms')
    expect(response.statusCode).toBe(200)
  })

  describe('/_matrix/identity/v2/account/register', () => {
    it('should require all parameters', async () => {
      const response = await request(app)
        .post('/_matrix/identity/v2/account/register')
        .send({ access_token: 'bar' })
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(400)
      expect(response.body.errcode).toEqual('M_MISSING_PARAMS')
    })
    it('should reject bad json', async () => {
      const spyOnLoggerError = jest.spyOn(idServer.logger, 'error')
      const response = await request(app)
        .post('/_matrix/identity/v2/account/register')
        .send('{"access_token": "bar"')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(400)
      expect(spyOnLoggerError).toHaveBeenCalledWith(
        'JSON error',
        expect.anything()
      )
    })
    it('should accept valid request', async () => {
      const mockResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: () => {
          return {
            sub: '@dwho:example.com',
            'm.server': 'matrix.example.com:8448'
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
    it('should log additional parameters', async () => {
      const spyOnLoggerWarn = jest.spyOn(idServer.logger, 'warn')
      const response = await request(app)
        .post('/_matrix/identity/v2/account/register')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(
          querystring.stringify({
            access_token: 'bar',
            expires_in: 86400,
            matrix_server_name: 'matrix.example.com',
            token_type: 'Bearer',
            additional_param: 'value'
          })
        )
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(200)
      expect(spyOnLoggerWarn).toHaveBeenCalledWith('Additional parameters', [
        'additional_param'
      ])
    })
    it('should reject missing "sub" from server', async () => {
      const mockResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: () => {
          return {
            email: 'dwho@example.com',
            'm.server': 'matrix.example.com:8448'
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
      expect(response.statusCode).toBe(401)
    })
    it('should reject bad "sub" from server', async () => {
      const mockResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: () => {
          return {
            sub: 'dwho@example.com',
            'm.server': 'matrix.example.com:8448'
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
      expect(response.statusCode).toBe(401)
    })
  })

  describe('Endpoint with authentication', () => {
    it('should reject if more than 100 requests are done in less than 10 seconds', async () => {
      let response
      let token
      // eslint-disable-next-line @typescript-eslint/no-for-in-array, @typescript-eslint/no-unused-vars
      for (const i in [...Array(101).keys()]) {
        token = Number(i) % 2 === 0 ? `Bearer ${validToken}` : 'falsy_token'
        response = await request(app)
          .post('/_matrix/identity/v2/validate/email/requestToken')
          .set('Authorization', token)
          .set('Accept', 'application/json')
      }
      expect((response as Response).statusCode).toEqual(429)
      await new Promise((resolve) => setTimeout(resolve, 11000))
    })

    describe('/_matrix/identity/v2/account', () => {
      it('should reject missing token (', async () => {
        const response = await request(app)
          .get('/_matrix/identity/v2/account')
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })
      it('should reject token that mismatch regex', async () => {
        const response = await request(app)
          .get('/_matrix/identity/v2/account')
          .set('Authorization', 'Bearer zzzzzzz')
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })
      it('should reject expired or invalid token', async () => {
        const response = await request(app)
          .get('/_matrix/identity/v2/account')
          .set('Authorization', `Bearer ${randomString(64)}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })
    })

    describe('/_matrix/identity/v2/validate/email', () => {
      let sid: string, token: string
      describe('/_matrix/identity/v2/validate/email/requestToken', () => {
        it('should refuse to register an invalid email', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/validate/email/requestToken')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret',
              email: '@yadd:debian.org',
              next_link: 'http://localhost:8090',
              send_attempt: 1
            })
          expect(response.statusCode).toBe(400)
          expect(sendMailMock).not.toHaveBeenCalled()
        })
        it('should refuse an invalid secret', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/validate/email/requestToken')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'my',
              email: 'yadd@debian.org',
              next_link: 'http://localhost:8090',
              send_attempt: 1
            })
          expect(response.statusCode).toBe(400)
          expect(sendMailMock).not.toHaveBeenCalled()
        })
        it('should accept valid email registration query', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/validate/email/requestToken')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret',
              email: 'xg@xnr.fr',
              next_link: 'http://localhost:8090',
              send_attempt: 1
            })
          expect(response.statusCode).toBe(200)
          expect(sendMailMock.mock.calls[0][0].to).toBe('xg@xnr.fr')
          expect(sendMailMock.mock.calls[0][0].raw).toMatch(
            /token=([a-zA-Z0-9]{64})&client_secret=mysecret&sid=([a-zA-Z0-9]{64})/
          )
          token = RegExp.$1
          sid = RegExp.$2
        })
      })
      describe('/_matrix/identity/v2/validate/email/submitToken', () => {
        /* Works but disabled to avoid invalidate previous token
        it('should refuse mismatch registration parameters', async () => {
          const response = await request(app)
            .get('/_matrix/identity/v2/validate/email/submitToken')
            .query({
              token,
              client_secret: 'mysecret2',
              sid
            })
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
        })
        */
        it('should reject registration with a missing parameter', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/validate/email/submitToken')
            .send({
              token,
              sid
            })
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
        })
        it('should accept to register mail after click', async () => {
          const response = await request(app)
            .get('/_matrix/identity/v2/validate/email/submitToken')
            .query({
              token,
              client_secret: 'mysecret',
              sid
            })
            .set('Accept', 'application/json')
          expect(response.body).toEqual({ success: true })
          expect(response.statusCode).toBe(200)
        })
        it('should refuse a second registration', async () => {
          const response = await request(app)
            .get('/_matrix/identity/v2/validate/email/submitToken')
            .query({
              token,
              client_secret: 'mysecret',
              sid
            })
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
        })
      })
    })

    describe('/_matrix/identity/v2/lookup', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let pepper = ''
      describe('/_matrix/identity/v2/hash_details', () => {
        it('should require authentication', async () => {
          await idServer.cronTasks?.ready
          const response = await request(app)
            .get('/_matrix/identity/v2/hash_details')
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(401)
        })
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
        it('should send an error if "addresses" is not an array', async () => {
          await idServer.cronTasks?.ready
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .send({
              addresses: 3,
              algorithm: 'sha256',
              pepper
            })
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
        })

        it('should send an error if one address is not a string', async () => {
          const hash = new Hash()
          await hash.ready
          await idServer.cronTasks?.ready
          const phoneHash = hash.sha256(`33612345678 msisdn ${pepper}`)
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .send({
              addresses: [phoneHash, 3],
              algorithm: 'sha256',
              pepper
            })
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
        })

        it('should send an error if exceeds hashes limit', async () => {
          const hash = new Hash()
          await hash.ready
          await idServer.cronTasks?.ready
          const phoneHash = hash.sha256(`33612345678 msisdn ${pepper}`)
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .send({
              addresses: Array.from({ length: 101 }, (_, i) => phoneHash),
              algorithm: 'sha256',
              pepper
            })
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
        })

        it('should return Matrix id', async () => {
          const hash = new Hash()
          await hash.ready
          await idServer.cronTasks?.ready
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
          expect(response.body.mappings[phoneHash]).toBe('@dwho:matrix.org')
        })
      })
    })

    describe('/_matrix/identity/v2/account', () => {
      it('should accept valid token in headers', async () => {
        const response = await request(app)
          .get('/_matrix/identity/v2/account')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
      })
      it('should accept valid token in query parameters', async () => {
        const response = await request(app)
          .get('/_matrix/identity/v2/account')
          .query({ access_token: validToken })
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
      })
      it('should logout (/_matrix/identity/v2/account/logout)', async () => {
        let response = await request(app)
          .post('/_matrix/identity/v2/account/logout')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        response = await request(app)
          .get('/_matrix/identity/v2/account')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })
    })
  })

  describe('/_matrix/identity/v2/ephemeral_pubkey/isvalid', () => {
    let shortKeyPair: { publicKey: string; privateKey: string; keyId: string }
    beforeAll(async () => {
      // Insert a test key into the database
      await idServer.db
        .createKeypair('shortTerm', 'curve25519')
        .then((keypair) => {
          shortKeyPair = keypair
        })
    })

    afterAll(async () => {
      // Remove the test key from the database
      await idServer.db.deleteEqual(
        'shortTermKeypairs',
        'keyID',
        shortKeyPair.keyId
      )
    })

    it('should return error 400 if no public_key is given (shortTerm case)', async () => {
      const response = await request(app).get(
        '/_matrix/identity/v2/ephemeral_pubkey/isvalid'
      )

      expect(response.statusCode).toBe(400)
      expect(response.body.errcode).toBe('M_MISSING_PARAMS')
    })

    it('should validate a valid ephemeral pubkey', async () => {
      const key = shortKeyPair.publicKey
      const response = await request(app).get(
        '/_matrix/identity/v2/ephemeral_pubkey/isvalid?public_key=' + key
      )

      expect(response.statusCode).toBe(200)
      expect(response.body.valid).toBe(true)
    })

    it('should invalidate an invalid ephemeral pubkey', async () => {
      const key = 'invalidPub'
      const response = await request(app).get(
        '/_matrix/identity/v2/ephemeral_pubkey/isvalid?public_key=' + key
      )

      expect(response.statusCode).toBe(200)
      expect(response.body.valid).toBe(false)
    })
  })

  describe('/_matrix/identity/v2/pubkey/isvalid', () => {
    let longKeyPair: { publicKey: string; privateKey: string; keyId: string }
    beforeAll(async () => {
      // Insert a test key into the database
      await idServer.db.createKeypair('longTerm', 'ed25519').then((keypair) => {
        longKeyPair = keypair
      })
    })

    afterAll(async () => {
      // Remove the test key from the database
      await idServer.db.deleteEqual(
        'longTermKeypairs',
        'keyID',
        longKeyPair.keyId
      )
    })
    it('should return error 400 if no public_key is given (longTerm case)', async () => {
      const response = await request(app).get(
        '/_matrix/identity/v2/pubkey/isvalid'
      )

      expect(response.statusCode).toBe(400)
      expect(response.body.errcode).toBe('M_MISSING_PARAMS')
    })

    it('should validate a valid long-term pubkey', async () => {
      const key = longKeyPair.publicKey
      const response = await request(app).get(
        '/_matrix/identity/v2/pubkey/isvalid?public_key=' + key
      )

      expect(response.statusCode).toBe(200)
      expect(response.body.valid).toBe(true)
    })

    it('should invalidate an invalid long-term pubkey', async () => {
      const key = 'invalidPub'
      const response = await request(app)
        .get('/_matrix/identity/v2/pubkey/isvalid')
        .query({ public_key: key })

      expect(response.statusCode).toBe(200)
      expect(response.body.valid).toBe(false)
    })
  })

  describe('/_matrix/identity/v2/pubkey/:keyID', () => {
    beforeAll(async () => {
      // Insert a test key into the database
      await idServer.db.createKeypair('longTerm', 'ed25519').then((keypair) => {
        longKeyPair = keypair
      })
      await idServer.db
        .createKeypair('shortTerm', 'curve25519')
        .then((_keypair) => {
          shortKeyPair = _keypair
        })
    })

    afterAll(async () => {
      // Remove the test key from the database
      await idServer.db.deleteEqual(
        'longTermKeypairs',
        'keyID',
        longKeyPair.keyId
      )
      await idServer.db.deleteEqual(
        'shortTermKeypairs',
        'keyID',
        shortKeyPair.keyId
      )
    })

    it('should return the public key when correct keyID is given (from long term key pairs)', async () => {
      const _keyID = longKeyPair.keyId
      const response = await request(app).get(
        `/_matrix/identity/v2/pubkey/${_keyID}`
      )

      expect(response.statusCode).toBe(200)
      expect(response.body.public_key).toBeDefined()
      expect(response.body.public_key).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(response.body.public_key).toBe(longKeyPair.publicKey)
    })

    it('should return the public key when correct keyID is given (from short term key pairs)', async () => {
      const _keyID = shortKeyPair.keyId
      const response = await request(app).get(
        `/_matrix/identity/v2/pubkey/${_keyID}`
      )

      expect(response.statusCode).toBe(200)
      expect(response.body.public_key).toBeDefined()
      expect(response.body.public_key).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(response.body.public_key).toBe(shortKeyPair.publicKey)
    })

    it('should return 404 when incorrect keyID is given', async () => {
      const _keyID = 'incorrectKeyID'
      const response = await request(app).get(
        `/_matrix/identity/v2/pubkey/${_keyID}`
      ) // exactly '/_matrix/identity/v2/pubkey/' + _keyID

      expect(response.statusCode).toBe(404)
      expect(response.body.errcode).toBe('M_NOT_FOUND')
    })
  })
})

describe('Use environment variables', () => {
  describe('For hashes rate limit', () => {
    let pepper: string
    const hash = new Hash()

    beforeAll((done) => {
      process.env.HASHES_RATE_LIMIT = '4'
      idServer = new IdServer()
      app = express()
      idServer.ready
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          Object.keys(idServer.api.get).forEach((k) => {
            app.get(k, idServer.api.get[k])
          })
          Object.keys(idServer.api.post).forEach((k) => {
            app.post(k, idServer.api.post[k])
          })
          const mockResponse = Promise.resolve({
            ok: true,
            status: 200,
            json: () => {
              return {
                sub: '@dwho:example.com',
                'm.server': 'matrix.example.com:8448'
              }
            }
          })
          // @ts-expect-error mock is unknown
          fetch.mockImplementation(async () => await mockResponse)
          return request(app)
            .post('/_matrix/identity/v2/account/register')
            .send({
              access_token: 'bar',
              expires_in: 86400,
              matrix_server_name: 'matrix.example.com',
              token_type: 'Bearer'
            })
        })
        .then((response) => {
          validToken = response.body.token
          return request(app)
            .get('/_matrix/identity/v2/hash_details')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((response) => {
          pepper = response.body.lookup_pepper as string
          return hash.ready
        })
        .then(() => {
          done()
        })
        .catch((e) => {
          done(e)
        })
    })

    afterAll(() => {
      idServer.cleanJobs()
      delete process.env.HASHES_RATE_LIMIT
    })

    it('should send an error if exceeds hashes limit', async () => {
      const phoneHash = hash.sha256(`33612345678 msisdn ${pepper}`)
      const response = await request(app)
        .post('/_matrix/identity/v2/lookup')
        .send({
          addresses: Array.from({ length: 5 }, (_, i) => phoneHash),
          algorithm: 'sha256',
          pepper
        })
        .set('Authorization', `Bearer ${validToken}`)
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(400)
    })

    it('should return Matrix id', async () => {
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
      expect(response.body.mappings[phoneHash]).toBe('@dwho:matrix.org')
    })
  })
})
