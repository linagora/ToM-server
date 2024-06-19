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
import { fillPoliciesDB } from './terms/index.post'
import { SmsService } from './utils/sms-service'

jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

const mockSend = jest.fn().mockResolvedValue(undefined)
const mockSmsService = {
  send: mockSend
} as unknown as jest.Mocked<SmsService>

// 2. Mock the SMS service class
jest.mock('./utils/sms-service', () => ({
  SmsService: jest.fn().mockImplementation(() => mockSmsService)
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
  try {
    fs.unlinkSync('src/__testData__/test.db')
  } catch (error) {
    console.log('failed to unlink test db', { error })
  }
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
  beforeAll((done) => {
    delete process.env.HASHES_RATE_LIMIT
    process.env.HASHES_RATE_LIMIT = 'falsy_number'
    done()
  })

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
    process.env.HASHES_RATE_LIMIT = '100'
    idServer = new IdServer(conf)
    app = express()

    idServer.ready
      .then(() => {
        for (const k of Object.keys(idServer.api.get)) {
          app.get(k, idServer.api.get[k])
        }

        for (const k of Object.keys(idServer.api.post)) {
          app.post(k, idServer.api.post[k])
        }

        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  afterAll(() => {
    idServer?.cleanJobs()
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
      const response = await request(app)
        .post('/_matrix/identity/v2/account/register')
        .send('{"access_token": "bar"')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(400)
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

  describe('/_matrix/identity/v2/pubkey', () => {
    describe('/_matrix/identity/v2/pubkey/ephemeral/isvalid', () => {
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
          '/_matrix/identity/v2/pubkey/ephemeral/isvalid'
        )

        expect(response.statusCode).toBe(400)
        expect(response.body.errcode).toBe('M_MISSING_PARAMS')
      })

      it('should validate a valid ephemeral pubkey', async () => {
        const key = shortKeyPair.publicKey
        const response = await request(app).get(
          '/_matrix/identity/v2/pubkey/ephemeral/isvalid?public_key=' + key
        )

        expect(response.statusCode).toBe(200)
        expect(response.body.valid).toBe(true)
      })

      it('should invalidate an invalid ephemeral pubkey', async () => {
        const key = 'invalidPub'
        const response = await request(app).get(
          '/_matrix/identity/v2/pubkey/ephemeral/isvalid?public_key=' + key
        )

        expect(response.statusCode).toBe(200)
        expect(response.body.valid).toBe(false)
      })
    })

    describe('/_matrix/identity/v2/pubkey/isvalid', () => {
      let longKeyPair: { publicKey: string; privateKey: string; keyId: string }
      beforeAll(async () => {
        // Insert a test key into the database
        longKeyPair = generateKeyPair('ed25519')
        await idServer.db.insert('longTermKeypairs', {
          name: 'currentKey',
          keyID: longKeyPair.keyId,
          public: longKeyPair.publicKey,
          private: longKeyPair.privateKey
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
      let longKeyPair: { publicKey: string; privateKey: string; keyId: string }
      let shortKeyPair: { publicKey: string; privateKey: string; keyId: string }
      beforeAll(async () => {
        // Insert a test key into the database
        longKeyPair = generateKeyPair('ed25519')
        await idServer.db.insert('longTermKeypairs', {
          name: 'currentKey',
          keyID: longKeyPair.keyId,
          public: longKeyPair.publicKey,
          private: longKeyPair.privateKey
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

  describe('Endpoint with authentication', () => {
    beforeEach(async () => {
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
      const response1 = await request(app)
        .post('/_matrix/identity/v2/account/register')
        .send({
          access_token: 'bar',
          expires_in: 86400,
          matrix_server_name: 'matrix.example.com',
          token_type: 'Bearer'
        })
        .set('Accept', 'application/json')
      expect(response1.statusCode).toBe(200)
      expect(response1.body.token).toMatch(/^[a-zA-Z0-9]{64}$/)
      validToken = response1.body.token
    })

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
        it('should refuse an invalid next_link', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/validate/email/requestToken')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret',
              email: 'yadd@debian.org',
              next_link: 'wrong link',
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
        it('should not resend an email for the same attempt', async () => {
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
          expect(sendMailMock).not.toHaveBeenCalled()
          expect(response.body).toEqual({ sid })
        })
        it('should resend an email for a different attempt', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/validate/email/requestToken')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret',
              email: 'xg@xnr.fr',
              next_link: 'http://localhost:8090',
              send_attempt: 2
            })
          expect(response.statusCode).toBe(200)
          expect(sendMailMock.mock.calls[0][0].to).toBe('xg@xnr.fr')
          expect(sendMailMock.mock.calls[0][0].raw).toMatch(
            /token=([a-zA-Z0-9]{64})&client_secret=mysecret&sid=([a-zA-Z0-9]{64})/
          )
          const newSid = RegExp.$2
          expect(response.body).toEqual({ sid: newSid })
          expect(sendMailMock).toHaveBeenCalled()
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
          it('should reject registration with wrong parameters', async () => {
            const response = await request(app)
              .post('/_matrix/identity/v2/validate/email/submitToken')
              .send({
                token,
                client_secret: 'wrongclientsecret',
                sid: 'wrongSid'
              })
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
          })
          it('should accept to register mail after click', async () => {
            const response = await request(app)
              .post('/_matrix/identity/v2/validate/email/submitToken')
              .send({
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
          it('should redirect to the next_link if it was provided in requestToken with the GET method', async () => {
            const requestTokenResponse = await request(app)
              .post('/_matrix/identity/v2/validate/email/requestToken')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({
                client_secret: 'my_secret2',
                email: 'abc@abcd.fr',
                next_link: 'http://localhost:8090',
                send_attempt: 1
              })
            expect(requestTokenResponse.statusCode).toBe(200)
            expect(sendMailMock.mock.calls[0][0].raw).toMatch(
              /token=([a-zA-Z0-9]{64})&client_secret=my_secret2&sid=([a-zA-Z0-9]{64})/
            )
            sid = RegExp.$2
            token = RegExp.$1
            const response = await request(app)
              .get('/_matrix/identity/v2/validate/email/submitToken')
              .query({
                client_secret: 'my_secret2',
                token,
                sid
              })
            expect(response.status).toBe(302)
            expect(response.headers.location).toBe(
              new URL('http://localhost:8090').toString()
            )
          })
        })
      })
    })

    describe('/_matrix/identity/v2/3pid', () => {
      describe('/_matrix/identity/v2/3pid/getValidated3pid', () => {
        let sid: string, token: string
        it('should reject missing parameters', async () => {
          const response = await request(app)
            .get('/_matrix/identity/v2/3pid/getValidated3pid')
            .query({
              client_secret: 'mysecret'
            })
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
          expect(response.body.errcode).toBe('M_MISSING_PARAMS')
        })
        it('should return 404 if no valid session is found', async () => {
          const response = await request(app)
            .get('/_matrix/identity/v2/3pid/getValidated3pid')
            .query({
              client_secret: 'invalidsecret',
              sid: 'invalidsid'
            })
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.body.errcode).toBe('M_NO_VALID_SESSION')
          expect(response.statusCode).toBe(404)
        })
        it('should return 400 if the session is not validated', async () => {
          const responseRequestToken = await request(app)
            .post('/_matrix/identity/v2/validate/email/requestToken')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'newsecret',
              email: 'xg@xnr.fr',
              next_link: 'http://localhost:8090',
              send_attempt: 1
            })
          expect(responseRequestToken.statusCode).toBe(200)
          expect(sendMailMock.mock.calls[0][0].to).toBe('xg@xnr.fr')
          expect(sendMailMock.mock.calls[0][0].raw).toMatch(
            /token=([a-zA-Z0-9]{64})&client_secret=newsecret&sid=([a-zA-Z0-9]{64})/
          )
          token = RegExp.$1
          sid = RegExp.$2

          const response = await request(app)
            .get('/_matrix/identity/v2/3pid/getValidated3pid')
            .set('Authorization', `Bearer ${validToken}`)
            .query({
              client_secret: 'newsecret',
              sid
            })
            .set('Accept', 'application/json')
          expect(response.body.errcode).toBe('M_SESSION_NOT_VALIDATED')
          expect(response.statusCode).toBe(400)
        })
        /* Works if the validationTime is set to 0 millisecond in 3pid/getValidated3pid.ts 
        it('should return 400 if the session is expired', async () => {
          const responseSubmitToken = await request(app)
            .get('/_matrix/identity/v2/validate/email/submitToken')
            .query({
              token,
              client_secret: 'newsecret',
              sid
            })
            .set('Accept', 'application/json')
          expect(responseSubmitToken.body).toEqual({ success: true })
          expect(responseSubmitToken.statusCode).toBe(200)
          const response = await request(app)
            .get('/_matrix/identity/v2/3pid/getValidated3pid')
            .set('Authorization', `Bearer ${validToken}`)
            .query({
              client_secret: 'newsecret',
              sid
            })
            .set('Accept', 'application/json')
          expect(response.body.errcode).toBe('M_SESSION_EXPIRED')
          expect(response.statusCode).toBe(400)
        })
        */
        it('should return 200 if a valid session is found', async () => {
          const responseSubmitToken = await request(app)
            .post('/_matrix/identity/v2/validate/email/submitToken')
            .send({
              token,
              client_secret: 'newsecret',
              sid
            })
            .set('Accept', 'application/json')
          expect(responseSubmitToken.body).toEqual({ success: true })
          expect(responseSubmitToken.statusCode).toBe(200)
          const response = await request(app)
            .get('/_matrix/identity/v2/3pid/getValidated3pid')
            .set('Authorization', `Bearer ${validToken}`)
            .query({
              client_secret: 'newsecret',
              sid
            })
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(200)
        })
      })

      describe('/_matrix/identity/v2/3pid/bind', () => {
        it('should find the 3pid - matrixID association after binding', async () => {
          const responseRequestToken = await request(app)
            .post('/_matrix/identity/v2/validate/email/requestToken')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret2',
              email: 'ab@abc.fr',
              next_link: 'http://localhost:8090',
              send_attempt: 1
            })
          expect(responseRequestToken.statusCode).toBe(200)
          expect(sendMailMock.mock.calls[0][0].to).toBe('ab@abc.fr')
          expect(sendMailMock.mock.calls[0][0].raw).toMatch(
            /token=([a-zA-Z0-9]{64})&client_secret=mysecret2&sid=([a-zA-Z0-9]{64})/
          )
          const bindToken = RegExp.$1
          const bindSid = RegExp.$2
          const responseSubmitToken = await request(app)
            .post('/_matrix/identity/v2/validate/email/submitToken')
            .send({
              token: bindToken,
              client_secret: 'mysecret2',
              sid: bindSid
            })
            .set('Accept', 'application/json')
          expect(responseSubmitToken.statusCode).toBe(200)
          const longKeyPair: {
            publicKey: string
            privateKey: string
            keyId: string
          } = generateKeyPair('ed25519')
          await idServer.db.insert('longTermKeypairs', {
            keyID: longKeyPair.keyId,
            public: longKeyPair.publicKey,
            private: longKeyPair.privateKey
          })
          const responseBind = await request(app)
            .post('/_matrix/identity/v2/3pid/bind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret2',
              sid: bindSid,
              mxid: '@ab:abc.fr'
            })
          expect(responseBind.statusCode).toBe(200)
          expect(responseBind.body).toHaveProperty('signatures')
          await idServer.cronTasks?.ready
          const response = await request(app)
            .get('/_matrix/identity/v2/hash_details')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.body).toHaveProperty('lookup_pepper')
          expect(response.statusCode).toBe(200)
          const pepper: string = response.body.lookup_pepper
          const hash = new Hash()
          await hash.ready
          const computedHash = hash.sha256(`ab@abc.fr mail ${pepper}`)
          const responseLookup = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .send({
              addresses: [computedHash],
              algorithm: 'sha256',
              pepper
            })
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(responseLookup.statusCode).toBe(200)
          expect(responseLookup.body.mappings).toEqual({
            [computedHash]: '@ab:abc.fr'
          })
        })
        it('should refuse an invalid client secret', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/3pid/bind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'a',
              sid: 'sid',
              mxid: '@ab:abc.fr'
            })
          expect(response.statusCode).toBe(400)
        })
        it('should refuse a session that has not been validated', async () => {
          const response1 = await request(app)
            .post('/_matrix/identity/v2/validate/email/requestToken')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret3',
              email: 'abc@abc.fr',
              next_link: 'http://localhost:8090',
              send_attempt: 1
            })
          expect(response1.statusCode).toBe(200)
          expect(sendMailMock).toHaveBeenCalled()
          const sid3: string = response1.body.sid
          const response2 = await request(app)
            .post('/_matrix/identity/v2/3pid/bind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret3',
              sid: sid3,
              mxid: '@abc:abc.fr'
            })
          expect(response2.body.errcode).toBe('M_SESSION_NOT_VALIDATED')
          expect(response2.statusCode).toBe(400)
        })
        it('should refuse an invalid Matrix ID', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/3pid/bind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret2',
              sid: 'sid',
              mxid: 'ab@abc.fr'
            })
          expect(response.body.errcode).toBe('M_INVALID_PARAM')
          expect(response.statusCode).toBe(400)
        })
        it('should refuse an invalid session_id', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/3pid/bind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret2',
              sid: '$!:',
              mxid: '@ab:abc.fr'
            })
          expect(response.body.errcode).toBe('M_INVALID_PARAM')
          expect(response.statusCode).toBe(400)
        })
        it('should refuse a non-existing session ID or client secret', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/3pid/bind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'invalid_client_secret',
              sid: 'invalid_sid',
              mxid: '@ab:abc.fr'
            })
          expect(response.body.errcode).toBe('M_NO_VALID_SESSION')
          expect(response.statusCode).toBe(404)
        })
      })
      describe('/_matrix/identity/v2/3pid/unbind', () => {
        let token4: string
        let sid4: string
        it('should refuse an invalid Matrix ID', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/3pid/unbind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              sid: 'sid',
              client_secret: 'mysecret4',
              threepid: {
                address: 'unbind@unbind.fr',
                medium: 'email'
              },
              mxid: 'unbind@unbind.fr'
            })
          expect(response.body.errcode).toBe('M_INVALID_PARAM')
          expect(response.statusCode).toBe(400)
        })
        it('should refuse an invalid client secret', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/3pid/unbind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              mxid: '@ab:abc.fr',
              client_secret: 'a',
              sid: 'sid',
              threepid: {
                address: 'ab@abc.fr',
                medium: 'email'
              }
            })
          expect(response.statusCode).toBe(400)
        })
        it('should refuse an invalid session id', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/3pid/unbind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              mxid: '@ab:abc.fr',
              sid: '$!:',
              client_secret: 'mysecret4',
              threepid: {
                address: 'ab@abc.fr',
                medium: 'email'
              }
            })
          expect(response.statusCode).toBe(400)
        })
        it('should refuse incompatible session_id and client_secret', async () => {
          const responseRequestToken = await request(app)
            .post('/_matrix/identity/v2/validate/email/requestToken')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret4',
              email: 'unbind@unbind.fr',
              send_attempt: 1
            })
          expect(responseRequestToken.statusCode).toBe(200)
          expect(sendMailMock).toHaveBeenCalled()
          expect(sendMailMock.mock.calls[0][0].to).toBe('unbind@unbind.fr')
          expect(sendMailMock.mock.calls[0][0].raw).toMatch(
            /token=([a-zA-Z0-9]{64})&client_secret=mysecret4&sid=([a-zA-Z0-9]{64})/
          )
          token4 = RegExp.$1
          sid4 = responseRequestToken.body.sid
          const responseSubmitToken = await request(app)
            .post('/_matrix/identity/v2/validate/email/submitToken')
            .send({
              token: token4,
              client_secret: 'mysecret4',
              sid: sid4
            })
            .set('Accept', 'application/json')
          expect(responseSubmitToken.statusCode).toBe(200)
          const responseBind = await request(app)
            .post('/_matrix/identity/v2/3pid/bind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'mysecret4',
              sid: sid4,
              mxid: '@unbind:unbind.fr'
            })
          expect(responseBind.statusCode).toBe(200)
          const response = await request(app)
            .post('/_matrix/identity/v2/3pid/unbind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              mxid: '@unbind:unbind.fr',
              client_secret: 'mysecret_',
              sid: sid4,
              threepid: {
                address: 'unbind@unbind.fr',
                medium: 'email'
              }
            })
          expect(response.statusCode).toBe(403)
        })
        it('should refuse an invalid threepid', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/3pid/unbind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              mxid: '@ab:abc.fr',
              sid: sid4,
              client_secret: 'mysecret4',
              threepid: {
                address: 'ab@ab.fr',
                medium: 'email'
              }
            })
          expect(response.statusCode).toBe(403)
        })
        it('should unbind a 3pid when given the right parameters', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/3pid/unbind')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              mxid: '@unbind:unbind.fr',
              client_secret: 'mysecret4',
              sid: sid4,
              threepid: {
                address: 'unbind@unbind.fr'
              }
            })
          expect(response.statusCode).toBe(200)
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

    describe('/_matrix/identity/v2/store-invite', () => {
      let longKeyPair: { publicKey: string; privateKey: string; keyId: string }
      beforeAll(async () => {
        // Insert a test key into the database
        longKeyPair = generateKeyPair('ed25519')
        await idServer.db.insert('longTermKeypairs', {
          name: 'currentKey',
          keyID: longKeyPair.keyId,
          public: longKeyPair.publicKey,
          private: longKeyPair.privateKey
        })
      })

      beforeAll(async () => {
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
        const response1 = await request(app)
          .post('/_matrix/identity/v2/account/register')
          .send({
            access_token: 'bar',
            expires_in: 86400,
            matrix_server_name: 'matrix.example.com',
            token_type: 'Bearer'
          })
          .set('Accept', 'application/json')
        expect(response1.statusCode).toBe(200)
        expect(response1.body.token).toMatch(/^[a-zA-Z0-9]{64}$/)
        validToken = response1.body.token
      })

      afterAll(async () => {
        // Remove the test key from the database
        await idServer.db.deleteEqual(
          'longTermKeypairs',
          'keyID',
          longKeyPair.keyId
        )
      })
      it('should require authentication', async () => {
        const response = await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Accept', 'application/json')
          .send({
            address: 'xg@xnr.fr',
            medium: 'email',
            room_id: '!room:matrix.org',
            sender: '@dwho:matrix.org'
          })
        expect(response.statusCode).toBe(401)
        expect(response.body.errcode).toEqual('M_UNAUTHORIZED')
      })
      it('should require all parameters', async () => {
        const response = await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            address: 'xg@xnr.fr',
            medium: 'email',
            room_id: '!room:matrix.org'
            // sender: '@dwho:matrix.org'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body.errcode).toEqual('M_MISSING_PARAMS')
      })
      it('should reject an invalid medium', async () => {
        const response = await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            address: 'xg@xnr.fr',
            medium: 'invalid medium',
            room_id: '!room:matrix.org',
            sender: '@dwho:matrix.org'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body.errcode).toEqual('M_UNRECOGNIZED')
      })
      it('should reject an invalid email', async () => {
        const response = await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            address: '@xg:xnr.fr',
            medium: 'email',
            room_id: '!room:matrix.org',
            sender: '@dwho:matrix.org'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body.errcode).toEqual('M_INVALID_PARAM')
      })
      it('should reject an invalid phone number', async () => {
        const response = await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            phone: '123',
            medium: 'msisdn',
            room_id: '!room:matrix.org',
            sender: '@dwho:matrix.org'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body.errcode).toEqual('M_INVALID_PARAM')
      })
      it('should alert if the lookup API did not behave as expected', async () => {
        const mockResponse = Promise.resolve({
          ok: false,
          status: 401, // should return 200 or 400
          json: () => {
            return {}
          }
        })
        // @ts-expect-error mock is unknown
        fetch.mockImplementation(async () => await mockResponse)
        await mockResponse
        const response = await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            address: 'xg@xnr.fr',
            medium: 'email',
            room_id: '!room:matrix.org',
            sender: '@dwho:matrix.org'
          })
        expect(response.statusCode).toBe(500)
        expect(response.body.errcode).toEqual('M_UNKNOWN')
        expect(response.body.error).toEqual(
          'Unexpected response statusCode from the /_matrix/identity/v2/lookup API'
        )
      })
      it('should not send a mail if the address is already binded to a matrix id', async () => {
        const mockResponse = Promise.resolve({
          ok: true,
          status: 200,
          json: () => {
            return {
              mappings: {
                '4kenr7N9drpCJ4AfalmlGQVsOn3o2RHjkADUpXJWZUc':
                  '@alice:example.org'
              }
            }
          }
        })
        // @ts-expect-error mock is unknown
        fetch.mockImplementation(async () => await mockResponse)
        await mockResponse
        const response = await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            address: 'xg@xnr.fr',
            medium: 'email',
            room_id: '!room:matrix.org',
            sender: '@alice:example.org'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body.errcode).toBe('M_THREEPID_IN_USE')
      })
      it('should accept a valid email request', async () => {
        const mockResponse = Promise.resolve({
          ok: false,
          status: 200,
          json: () => {}
        })
        // @ts-expect-error mock is unknown
        fetch.mockImplementation(async () => await mockResponse)
        await mockResponse
        const response = await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            address: 'xg@xnr.fr',
            medium: 'email',
            room_id: '!room:matrix.org',
            sender: '@dwho:matrix.org'
          })
        expect(response.statusCode).toBe(200)
        expect(sendMailMock).toHaveBeenCalled()
        expect(sendMailMock.mock.calls[0][0].to).toBe('xg@xnr.fr')
        expect(response.body).toHaveProperty('display_name')
        expect(response.body.display_name).not.toBe('xg@xnr.fr')
        expect(response.body).toHaveProperty('public_keys')
        expect(response.body).toHaveProperty('token')
        expect(response.body.token).toMatch(/^[a-zA-Z0-9]{64}$/)
      })
      it('should accept a valid phone number request', async () => {
        const mockResponse = Promise.resolve({
          ok: false,
          status: 200,
          json: () => {
            return {}
          }
        })
        // @ts-expect-error mock is unknown
        fetch.mockImplementation(async () => await mockResponse)
        await mockResponse
        const response = await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            phone: '33612345678',
            medium: 'msisdn',
            room_id: '!room:matrix.org',
            sender: '@dwho:matrix.org'
          })
        expect(response.statusCode).toBe(200)
        expect(mockSend).toHaveBeenCalled()
        expect(response.body).toHaveProperty('display_name')
        expect(response.body.display_name).not.toBe('33612345678')
        expect(response.body).toHaveProperty('public_keys')
        expect(response.body).toHaveProperty('token')
        expect(response.body.token).toMatch(/^[a-zA-Z0-9]{64}$/)
      })

      it('should accept invitation link', async () => {
        const mockResponse = Promise.resolve({
          ok: false,
          status: 200,
          json: () => {}
        })
        // @ts-expect-error mock is unknown
        fetch.mockImplementation(async () => await mockResponse)
        await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            phone: '33612345678',
            medium: 'msisdn',
            room_id: '!room:matrix.org',
            sender: '@dwho:matrix.org',
            invitation_link: 'https://example.com'
          })

        expect(mockSend).toHaveBeenCalledWith('33612345678', expect.anything())
      })
    })

    describe('/_matrix/identity/v2/sign-ed25519', () => {
      let keyPair: {
        publicKey: string
        privateKey: string
        keyId: string
      }
      let token: string
      let longKeyPair: { publicKey: string; privateKey: string; keyId: string }
      beforeAll(async () => {
        keyPair = generateKeyPair('ed25519')
        longKeyPair = generateKeyPair('ed25519')
        try {
          await idServer.db.deleteEqual(
            'longTermKeypairs',
            'name',
            'currentKey'
          )
          await idServer.db.insert('longTermKeypairs', {
            name: 'currentKey',
            keyID: longKeyPair.keyId,
            public: longKeyPair.publicKey,
            private: longKeyPair.privateKey
          })
        } catch (error) {
          console.log({ error })
        }
      })

      beforeEach(async () => {
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
        const response1 = await request(app)
          .post('/_matrix/identity/v2/account/register')
          .send({
            access_token: 'bar',
            expires_in: 86400,
            matrix_server_name: 'matrix.example.com',
            token_type: 'Bearer'
          })
          .set('Accept', 'application/json')
        expect(response1.statusCode).toBe(200)
        expect(response1.body.token).toMatch(/^[a-zA-Z0-9]{64}$/)
        validToken = response1.body.token
      })

      afterAll(async () => {
        await idServer.db.deleteEqual(
          'longTermKeypairs',
          'keyID',
          longKeyPair.keyId
        )
      })
      it('should refuse an invalid Matrix ID', async () => {
        const mockResponse = Promise.resolve({
          ok: false,
          status: 200,
          json: () => {}
        })
        // @ts-expect-error mock is unknown
        fetch.mockImplementation(async () => await mockResponse)
        const responseStoreInvite = await request(app)
          .post('/_matrix/identity/v2/store-invite')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            address: 'xg@xnr.fr',
            medium: 'email',
            room_id: '!room:matrix.org',
            sender: '@dwho:matrix.org'
          })
        expect(responseStoreInvite.statusCode).toBe(200)
        token = responseStoreInvite.body.token
        const response = await request(app)
          .post('/_matrix/identity/v2/sign-ed25519')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            mxid: 'invalid_mxid',
            private_key: keyPair.privateKey,
            token
          })
        expect(response.statusCode).toBe(400)
      })
      it('should refuse an empty token', async () => {
        const response = await request(app)
          .post('/_matrix/identity/v2/sign-ed25519')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            mxid: '@test:matrix.org',
            private_key: keyPair.privateKey,
            token: ''
          })
        expect(response.statusCode).toBe(400)
      })
      it('should refuse an invalid token', async () => {
        const response = await request(app)
          .post('/_matrix/identity/v2/sign-ed25519')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            mxid: '@test:matrix.org',
            private_key: keyPair.privateKey,
            token: 'invalidtoken'
          })
        expect(response.statusCode).toBe(404)
      })
      it('should accept a valid token and sign the invitation details', async () => {
        const response = await request(app)
          .post('/_matrix/identity/v2/sign-ed25519')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
          .send({
            mxid: '@test:matrix.org',
            private_key: keyPair.privateKey,
            token
          })
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty('signatures')
        const serverName = idServer.conf.server_name
        expect(response.body.signatures[serverName]).toBeDefined()
        expect(response.body.mxid).toBe('@test:matrix.org')
        expect(response.body.sender).toBe('@dwho:matrix.org')
        expect(response.body).toHaveProperty('token')
      })
    })

    describe('/_matrix/identity/v2/account', () => {
      beforeAll(async () => {
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
        const response1 = await request(app)
          .post('/_matrix/identity/v2/account/register')
          .send({
            access_token: 'bar',
            expires_in: 86400,
            matrix_server_name: 'matrix.example.com',
            token_type: 'Bearer'
          })
          .set('Accept', 'application/json')
        expect(response1.statusCode).toBe(200)
        expect(response1.body.token).toMatch(/^[a-zA-Z0-9]{64}$/)
        validToken = response1.body.token
      })
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

// This test has to be executed after the others so as not to add policies to the database and make the authentication fail for all the other tests
describe('_matrix/identity/v2/terms', () => {
  process.env.HASHES_RATE_LIMIT = '4'
  let idServer2: IdServer
  let conf2: Config
  let app2: express.Application
  let validToken2: string
  let userId: string
  const policies = {
    privacy_policy: {
      en: {
        name: 'Privacy Policy',
        url: 'https://example.org/somewhere/privacy-1.2-en.html'
      },
      fr: {
        name: 'Politique de confidentialité',
        url: 'https://example.org/somewhere/privacy-1.2-fr.html'
      },
      version: '1.2'
    },
    terms_of_service: {
      en: {
        name: 'Terms of Service',
        url: 'https://example.org/somewhere/terms-2.0-en.html'
      },
      fr: {
        name: "Conditions d'utilisation",
        url: 'https://example.org/somewhere/terms-2.0-fr.html'
      },
      version: '2.0'
    }
  }
  beforeAll((done) => {
    conf2 = {
      ...defaultConfig,
      database_engine: 'sqlite',
      base_url: 'http://example.com/',
      userdb_engine: 'sqlite',
      policies
    }
    idServer2 = new IdServer(conf2)
    app2 = express()

    idServer2.ready
      .then(() => {
        Object.keys(idServer2.api.get).forEach((k) => {
          app2.get(k, idServer2.api.get[k])
        })
        Object.keys(idServer.api.post).forEach((k) => {
          app2.post(k, idServer2.api.post[k])
        })
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  afterAll(() => {
    idServer2.cleanJobs()
  })
  it('copy of register test', async () => {
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
    const response = await request(app2)
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
    validToken2 = response.body.token
  })
  it('should update policies', async () => {
    const rows = await idServer2.db.get('accessTokens', ['data'], {
      id: validToken2
    })
    userId = JSON.parse(rows[0].data as string).sub
    await idServer2.db.insert('userPolicies', {
      policy_name: 'terms_of_service 2.0',
      user_id: userId,
      accepted: 0
    })
    const response2 = await request(app2)
      .post('/_matrix/identity/v2/terms')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${validToken2}`)
      .send({ user_accepts: policies.terms_of_service.en.url })
    expect(response2.statusCode).toBe(200)
    const response3 = await idServer2.db.get('userPolicies', ['accepted'], {
      user_id: userId,
      policy_name: 'terms_of_service 2.0'
    })
    expect(response3[0].accepted).toBe(1)
  })
  it('should refuse authentifying a user that did not accept the terms', async () => {
    fillPoliciesDB(userId, idServer2, 0)
    const response = await request(app2)
      .get('/_matrix/identity/v2/account')
      .set('Authorization', `Bearer ${validToken2}`)
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(403)
  })
})
