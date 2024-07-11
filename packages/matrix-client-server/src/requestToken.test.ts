import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from './index'
import { buildMatrixDb, buildUserDB } from './__testData__/buildUserDB'
import { type Config } from './types'
import defaultConfig from './__testData__/requestTokenConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { epoch } from '@twake/utils'
import { getSubmitUrl } from './register/email/requestToken'

process.env.TWAKE_CLIENT_SERVER_CONF =
  './src/__testData__/requestTokenConf.json'
jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

let conf: Config
let clientServer: ClientServer
let app: express.Application
let token: string
let sid: string

const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  // @ts-expect-error TS doesn't understand that the config is valid
  conf = {
    ...defaultConfig,
    cron_service: false,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    matrix_database_engine: 'sqlite'
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
  fs.unlinkSync('src/__testData__/testRequestToken.db')
  fs.unlinkSync('src/__testData__/testMatrixRequestToken.db')
})

beforeEach(() => {
  jest.clearAllMocks()
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
        Object.keys(clientServer.api.delete).forEach((k) => {
          app.delete(k, clientServer.api.delete[k])
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
  describe('/_matrix/client/v3/register/email/requestToken', () => {
    it('should refuse to register an invalid email', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/email/requestToken')
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
        .post('/_matrix/client/v3/register/email/requestToken')
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
        .post('/_matrix/client/v3/register/email/requestToken')
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
        .post('/_matrix/client/v3/register/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          email: 'xg@xnr.fr',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(200)
      expect(sendMailMock).not.toHaveBeenCalled()
      expect(response.body).toEqual({
        sid,
        submit_url: getSubmitUrl(clientServer.conf)
      })
    })
    it('should resend an email for a different attempt', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/email/requestToken')
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
      expect(response.body).toEqual({
        sid: newSid,
        submit_url: getSubmitUrl(clientServer.conf)
      })
      expect(sendMailMock).toHaveBeenCalled()
    })
    it('should refuse to send an email to an already existing user', async () => {
      await clientServer.matrixDb.insert('user_threepids', {
        user_id: '@xg:localhost',
        medium: 'email',
        address: 'xg@localhost.com',
        validated_at: epoch(),
        added_at: epoch()
      })
      const response = await request(app)
        .post('/_matrix/client/v3/register/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          email: 'xg@localhost.com',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_THREEPID_IN_USE')
      expect(sendMailMock).not.toHaveBeenCalled()
    })
  })

  describe('/_matrix/client/v3/register/email/submitToken', () => {
    it('should reject registration with a missing parameter', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/email/submitToken')
        .send({
          token,
          sid
        })
        .set('Accept', 'application/json')
      expect(response.statusCode).toBe(400)
    })
    it('should accept to register mail after click', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/email/submitToken')
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
        .get('/_matrix/client/v3/register/email/submitToken')
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
        .post('/_matrix/client/v3/register/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret2',
          email: 'abc@abcd.fr',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(requestTokenResponse.statusCode).toBe(200)
      expect(sendMailMock.mock.calls[0][0].raw).toMatch(
        /token=([a-zA-Z0-9]{64})&client_secret=mysecret2&sid=([a-zA-Z0-9]{64})/
      )
      sid = RegExp.$2
      token = RegExp.$1
      const response = await request(app)
        .get('/_matrix/client/v3/register/email/submitToken')
        .query({
          client_secret: 'mysecret2',
          token,
          sid
        })
      expect(response.status).toBe(302)
      expect(response.headers.location).toBe('http://localhost:8090')
    })
  })

  describe('/_matrix/client/v3/account/password/email/requestToken', () => {
    let sid: string
    it('should refuse to register an invalid email', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/email/requestToken')
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
        .post('/_matrix/client/v3/account/password/email/requestToken')
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
      await clientServer.matrixDb.insert('user_threepids', {
        user_id: '@newuser:localhost',
        medium: 'email',
        address: 'newuser@localhost.com',
        validated_at: epoch(),
        added_at: epoch()
      })
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          email: 'newuser@localhost.com',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(200)
      expect(sendMailMock.mock.calls[0][0].to).toBe('newuser@localhost.com')
      expect(sendMailMock.mock.calls[0][0].raw).toMatch(
        /token=([a-zA-Z0-9]{64})&client_secret=mysecret&sid=([a-zA-Z0-9]{64})/
      )
      sid = RegExp.$2
    })
    it('should not resend an email for the same attempt', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          email: 'newuser@localhost.com',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(200)
      expect(sendMailMock).not.toHaveBeenCalled()
      expect(response.body).toEqual({
        sid,
        submit_url: getSubmitUrl(clientServer.conf)
      })
    })
    it('should resend an email for a different attempt', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          email: 'newuser@localhost.com',
          next_link: 'http://localhost:8090',
          send_attempt: 2
        })
      expect(response.statusCode).toBe(200)
      expect(sendMailMock.mock.calls[0][0].to).toBe('newuser@localhost.com')
      expect(sendMailMock.mock.calls[0][0].raw).toMatch(
        /token=([a-zA-Z0-9]{64})&client_secret=mysecret&sid=([a-zA-Z0-9]{64})/
      )
      const newSid = RegExp.$2
      expect(response.body).toEqual({
        sid: newSid,
        submit_url: getSubmitUrl(clientServer.conf)
      })
      expect(sendMailMock).toHaveBeenCalled()
    })
    it('should refuse to send an email to a non-existing user', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          email: 'nonexistinguser@localhost.com',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_THREEPID_NOT_FOUND')
      expect(sendMailMock).not.toHaveBeenCalled()
    })
  })
})
