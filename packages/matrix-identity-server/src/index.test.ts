/* eslint-disable @typescript-eslint/naming-convention */
import {
  generateKeyPair,
  Hash,
  randomString,
  supportedHashes
} from '@twake/crypto'
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
        })
        it('should resend an email for a different attempt', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/validate/email/requestToken')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'my_secret',
              email: 'xg@xnr.fr',
              next_link: 'http://localhost:8090',
              send_attempt: 1
            })
            .send({
              client_secret: 'my_secret',
              email: 'xg@xnr.fr',
              next_link: 'http://localhost:8090',
              send_attempt: 2
            })
          expect(response.statusCode).toBe(200)
          expect(sendMailMock.mock.calls[0][0].to).toBe('xg@xnr.fr')
          expect(sendMailMock.mock.calls[0][0].raw).toMatch(
            /token=([a-zA-Z0-9]{64})&client_secret=my_secret&sid=([a-zA-Z0-9]{64})/
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
    })

      describe('/_matrix/identity/v2/3pid', () => {
        describe('/_matrix/identity/v2/3pid/getValidated3pid', () => {
          let sid: string, token: string
          it('should return 404 if no valid session is found', async () => {
            const response = await request(app)
              .get('/_matrix/identity/v2/3pid/getValidated3pid')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({
                client_secret: 'invalid_secret',
                sid: 'invalid_sid'
              })
            expect(response.body.errcode).toBe('M_NO_VALID_SESSION')
            expect(response.statusCode).toBe(404)
          })
          // Necessary test to get the sid and token
          test('copy of requestToken test', async () => {
            const response = await request(app)
              .post('/_matrix/identity/v2/validate/email/requestToken')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({
                client_secret: 'newsecret',
                email: 'xg@xnr.fr',
                next_link: 'http://localhost:8090',
                send_attempt: 1
              })
            expect(response.statusCode).toBe(200)
            expect(sendMailMock.mock.calls[0][0].to).toBe('xg@xnr.fr')
            expect(sendMailMock.mock.calls[0][0].raw).toMatch(
              /token=([a-zA-Z0-9]{64})&client_secret=newsecret&sid=([a-zA-Z0-9]{64})/
            )
            token = RegExp.$1
            sid = RegExp.$2
          })
          it('should return 400 if the session is not validated', async () => {
            const response = await request(app)
              .get('/_matrix/identity/v2/3pid/getValidated3pid')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({
                client_secret: 'newsecret',
                sid
              })
            expect(response.body.errcode).toBe('M_SESSION_NOT_VALIDATED')
            expect(response.statusCode).toBe(400)
          })
          // Necessary test to validate the session
          test('copy of submitToken test', async () => {
            const response = await request(app)
              .get('/_matrix/identity/v2/validate/email/submitToken')
              .query({
                token,
                client_secret: 'newsecret',
                sid
              })
              .set('Accept', 'application/json')
            expect(response.body).toEqual({ success: true })
            expect(response.statusCode).toBe(200)
          })
          /* Works if the validationTime is set to 1 millisecond in 3pid/index.ts
        it('should return 400 if the session is expired', async () => {
          const response = await request(app)
            .get('/_matrix/identity/v2/3pid/getValidated3pid')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              client_secret: 'newsecret',
              sid
            })
          expect(response.body.errcode).toBe('M_SESSION_EXPIRED')
          expect(response.statusCode).toBe(400)
        })
        */
          it('should return 200 if a valid session is found', async () => {
            const response = await request(app)
              .get('/_matrix/identity/v2/3pid/getValidated3pid')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({
                client_secret: 'newsecret',
                sid
              })
            expect(response.statusCode).toBe(200)
          })
        })
        describe('/_matrix/identity/v2/3pid/bind', () => {
          it('should find the 3pid - matrixID association after binding', async () => {
            const response_request_token = await request(app)
              .post('/_matrix/identity/v2/validate/email/requestToken')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({
                client_secret: 'mysecret2',
                email: 'ab@abc.fr',
                next_link: 'http://localhost:8090',
                send_attempt: 1
              })
            expect(response_request_token.statusCode).toBe(200)
            expect(sendMailMock.mock.calls[0][0].to).toBe('ab@abc.fr')
            expect(sendMailMock.mock.calls[0][0].raw).toMatch(
              /token=([a-zA-Z0-9]{64})&client_secret=mysecret2&sid=([a-zA-Z0-9]{64})/
            )
            const bind_token = RegExp.$1
            const bind_sid = RegExp.$2
            const response_submit_token = await request(app)
              .post('/_matrix/identity/v2/validate/email/submitToken')
              .send({
                token: bind_token,
                client_secret: 'mysecret2',
                sid: bind_sid
              })
              .set('Accept', 'application/json')
            expect(response_submit_token.statusCode).toBe(200)
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
            const response_bind = await request(app)
              .post('/_matrix/identity/v2/3pid/bind')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({
                client_secret: 'mysecret2',
                sid: bind_sid,
                mxid: '@ab:abc.fr'
              })
            expect(response_bind.statusCode).toBe(200)
            expect(response_bind.body).toHaveProperty('signatures')
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
            const response_lookup = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .send({
                addresses: [computedHash],
                algorithm: 'sha256',
                pepper
              })
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response_lookup.statusCode).toBe(200)
            expect(response_lookup.body.mappings).toEqual({
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
            const sid3:string = response1.body.sid
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


