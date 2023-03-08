import express from 'express'
import request from 'supertest'
import IdServer from './index'
import fs from 'fs'
import { randomString } from './utils/tokenUtils'

process.env.TWAKE_IDENTITY_SERVER_CONF = './src/__testData__/registerConf.json'

const idServer = new IdServer()

const app = express()

let validToken: string

idServer.ready.then(() => {
  // @ts-ignore
  Object.keys(idServer.api.get).forEach(k => {
    // @ts-ignore
    app.get(k, idServer.api.get[k])
  })
  // @ts-ignore
  Object.keys(idServer.api.post).forEach(k => {
    // @ts-ignore
    app.post(k, idServer.api.post[k])
  })  
})

beforeAll(async () => {
  await idServer.ready
})

beforeEach(() => {
  jest.clearAllMocks()
})

afterAll(() => {
  fs.unlinkSync('src/__testData__/test.db')
})

test('Reject /', async () => {
  const response = await request(app).get('/')
  expect(response.statusCode).toBe(403)
})

test('versions endpoint', async () => {
  const response = await request(app).get('/_matrix/identity/versions')
  expect(response.statusCode).toBe(200)
})

describe('register endpoint (v2)', () => {
  it('should require all parameters', async () => {
    const response = await request(app)
      .post('/_matrix/identity/v2/account/register')
      .send({access_token: "bar"})
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(400)
    expect(response.body.errcode).toEqual('M_MISSING_PARAMS')
  })
  it('should reject bad json', async () => {
    console.error = jest.fn()
    const response = await request(app)
      .post('/_matrix/identity/v2/account/register')
      .send('{"access_token": "bar"')
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(400)
    // @ts-ignore
    expect(console.error.mock.calls[0][0]).toMatch(/JSON error/i)
  })
  it('should accept valid request', async () => {
    const response = await request(app)
      .post('/_matrix/identity/v2/account/register')
      .send({
        access_token: "bar",
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
        access_token: "bar",
        expires_in: 86400,
        matrix_server_name: 'matrix.example.com',
        token_type: 'Bearer',
        additional_param: 'value'
      })
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(200)
    // @ts-ignore
    expect(console.warn.mock.calls[0][1][0]).toMatch(/\badditional_param\b/i)
  })
})

describe('Authentication', () => {
  it('should reject missing token', async () => {
    const response = await request(app)
      .get('/_matrix/identity/v2/account')
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(401)
  })
  it('should reject token that mismatch regex', async () => {
    const response = await request(app)
      .get('/_matrix/identity/v2/account')
      .set('Authorization', `Bearer zzzzzzz`)
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

describe('account v2 endpoint', () => {
  it('should accept valid token', async () => {
    const response = await request(app)
      .get('/_matrix/identity/v2/account')
      .set('Authorization', `Bearer ${validToken}`)
      .set('Accept', 'application/json')
    expect(response.statusCode).toBe(200)
  })
  it('should logout',async () => {
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
