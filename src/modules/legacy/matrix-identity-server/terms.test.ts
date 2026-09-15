import express from 'express'
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import request from 'supertest'
import buildUserDB from './__testData__/buildUserDB'
import defaultConfig from './__testData__/termsConf.json'
import IdServer from './index'
import { type Policies } from './terms'
import { type Config } from './types'
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock, test } from 'bun:test'

const sendMailMock = mock()
const createTransportMock = mock().mockImplementation(() => ({
  sendMail: sendMailMock
}))

mock.module('node-fetch', () => ({
  default: mock()
}))

mock.module('nodemailer', () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock
}))

process.env.TWAKE_IDENTITY_SERVER_CONF = path.join(
  import.meta.dirname,
  '__testData__',
  'termsConf.json'
)

let idServer: IdServer
let validToken: string
let app: express.Application

beforeAll((done) => {
  const conf: Config = {
    ...defaultConfig,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    sms_api_key: 'test_key',
    sms_api_login: 'test_secret',
    sms_api_url: 'http://localhost/sms/api'
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
  mock.clearAllMocks()
  createTransportMock.mockImplementation(() => ({
    sendMail: sendMailMock
  }))
})

afterAll(() => {
  fs.unlinkSync(path.join(import.meta.dirname, '__testData__', 'terms.db'))
  idServer.cleanJobs()
})

test('Get authentication token', async () => {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let policies: Policies

describe('When "terms of use" exists', () => {
  describe('/_matrix/identity/v2/terms', () => {
    it('should return policies', async () => {
      const response = await request(app).get('/_matrix/identity/v2/terms')
      expect(response.statusCode).toBe(200)
      policies = response.body
    })
    it('should refuse bad urls', async () => {
      const response = await request(app)
        .post('/_matrix/identity/v2/terms')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ user_accepts: ['https://twake.app/policy'] })
      expect(response.statusCode).toBe(400)
    })
    it('should accept valid url', async () => {
      const response = await request(app)
        .post('/_matrix/identity/v2/terms')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          user_accepts: ['https://example.org/somewhere/privacy-1.2-en.html']
        })
      expect(response.statusCode).toBe(200)
    })
  })
})
