import express from 'express'
import request from 'supertest'
import IdServer from './index'
import fs from 'fs'
import { randomString } from './utils/tokenUtils'
import fetch from 'node-fetch'

jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

process.env.TWAKE_IDENTITY_SERVER_CONF = './src/__testData__/registerConf.json'

const idServer = new IdServer()

const app = express()

let validToken: string

void idServer.ready.then(() => {
  // @ts-expect-error api is always defind when "ready"
  Object.keys(idServer.api.get).forEach(k => {
    // @ts-expect-error api is always defind when "ready"
    app.get(k, idServer.api.get[k])
  })
  // @ts-expect-error api is always defind when "ready"
  Object.keys(idServer.api.post).forEach(k => {
    // @ts-expect-error api is always defind when "ready"
    app.post(k, idServer.api.post[k])
  })
})

beforeAll(async () => {
  await idServer.ready
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
  fs.unlinkSync('src/__testData__/test.db')
  clearTimeout(idServer.db?.cleanJob)
})

test('Reject unimplemented endpoint with 404', async () => {
  const response = await request(app).get('/_matrix/unknown')
  expect(response.statusCode).toBe(404)
})

test('Reject bad method with 405', async () => {
  const response = await request(app).get('/_matrix/identity/v2/account/register')
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
    console.error = jest.fn()
    const response = await request(app)
      .post('/_matrix/identity/v2/account/register')
      .send('{"access_token": "bar"')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(400)
    // @ts-expect-error mock is unknown
    expect(console.error.mock.calls[0][0]).toMatch(/JSON error/i)
  })
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
  it('should log additional parameters', async () => {
    console.warn = jest.fn()
    const response = await request(app)
      .post('/_matrix/identity/v2/account/register')
      .send({
        access_token: 'bar',
        expires_in: 86400,
        matrix_server_name: 'matrix.example.com',
        token_type: 'Bearer',
        additional_param: 'value'
      })
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(200)
    // @ts-expect-error mock is unknown
    expect(console.warn.mock.calls[0][1][0]).toMatch(/\badditional_param\b/i)
  })
  it('should reject missing "sub" from server', async () => {
    const mockResponse = Promise.resolve({
      ok: true,
      status: 200,
      json: () => {
        return {
          email: 'dwho@example.com'
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
    expect(response.statusCode).toBe(500)
  })
  it('should reject bad "sub" from server', async () => {
    const mockResponse = Promise.resolve({
      ok: true,
      status: 200,
      json: () => {
        return {
          sub: 'dwho@example.com'
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
    expect(response.statusCode).toBe(500)
  })
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
  let sid: string,
    token: string
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
      expect(sendMailMock.mock.calls[0][0].raw).toMatch(/token=([a-zA-Z0-9]{64})&client_secret=mysecret&sid=([a-zA-Z0-9]{64})/)
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
        .get('/_matrix/identity/v2/validate/email/submitToken')
        .query({
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
