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

const sendSMSMock = jest.fn()
jest.mock('./utils/smsSender', () => {
  return jest.fn().mockImplementation(() => {
    return {
      sendSMS: sendSMSMock
    }
  })
})

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
    it('should refuse an invalid next_link', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/email/requestToken')
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
    it('should refuse a send_attempt that is not a number', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          email: 'yadd@debian.org',
          next_link: 'http://localhost:8090',
          send_attempt: 'NaN'
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid send attempt')
      expect(sendMailMock).not.toHaveBeenCalled()
    })
    it('should refuse a send_attempt that is too large', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          email: 'yadd@debian.org',
          next_link: 'http://localhost:8090',
          send_attempt: 999999999999
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid send attempt')
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
    it('should reject registration with wrong parameters', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/email/submitToken')
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
      expect(response.headers.location).toBe(
        new URL('http://localhost:8090').toString()
      )
    })
  })

  describe('/_matrix/client/v3/register/msisdn/requestToken', () => {
    it('should refuse to register an invalid phone number', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '@yadd:debian.org',
          country: 'FR',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid phone number')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    it('should refuse to register an invalid  country', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '0618384839',
          country: '123',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid country')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    it('should refuse an invalid secret', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'my',
          phone_number: '0618384839',
          country: 'FR',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid client_secret')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    it('should refuse an invalid next_link', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '0618384839',
          country: 'FR',
          next_link: 'wrong link',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid next_link')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    it('should refuse a send_attempt that is not a number', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '0618384839',
          country: 'FR',
          next_link: 'http://localhost:8090',
          send_attempt: 'NaN'
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid send attempt')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    it('should refuse a send_attempt that is too large', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '0618384839',
          country: 'FR',
          next_link: 'http://localhost:8090',
          send_attempt: 999999999999
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid send attempt')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    // this test is expected to work with the current behaviour of the sendSMS function which is to write in a file, and not to send a real SMS
    it('should accept valid phone number registration query', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          country: 'GB',
          phone_number: '07700900001',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(200)
      const sentSMS = sendSMSMock.mock.calls[0][0]
      expect(sentSMS.to).toBe('447700900001')
      const rawMessage = sentSMS.raw
      expect(rawMessage).toMatch(
        /token=([a-zA-Z0-9]{64})&client_secret=mysecret&sid=([a-zA-Z0-9]{64})/
      )
      const tokenMatch = rawMessage.match(/token=([a-zA-Z0-9]{64})/)
      const sidMatch = rawMessage.match(/sid=([a-zA-Z0-9]{64})/)
      expect(tokenMatch).not.toBeNull()
      expect(sidMatch).not.toBeNull()
      if (tokenMatch != null) token = tokenMatch[1]
      if (sidMatch != null) sid = sidMatch[1]
    })
    it('should not resend an SMS for the same attempt', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          country: 'GB',
          phone_number: '07700900001',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(200)
      expect(sendSMSMock).not.toHaveBeenCalled()
      expect(response.body).toEqual({
        sid,
        submit_url: getSubmitUrl(clientServer.conf)
      })
    })
    it('should resend an SMS for a different attempt', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          country: 'GB',
          phone_number: '07700900001',
          next_link: 'http://localhost:8090',
          send_attempt: 2
        })
      expect(response.statusCode).toBe(200)
      const sentSMS = sendSMSMock.mock.calls[0][0]
      expect(sentSMS.to).toBe('447700900001')
      const rawMessage = sentSMS.raw
      expect(rawMessage).toMatch(
        /token=([a-zA-Z0-9]{64})&client_secret=mysecret&sid=([a-zA-Z0-9]{64})/
      )
      const sidMatch = rawMessage.match(/sid=([a-zA-Z0-9]{64})/)
      expect(sidMatch).not.toBeNull()
      const newSid = sidMatch[1]
      expect(response.body).toEqual({
        sid: newSid,
        submit_url: getSubmitUrl(clientServer.conf)
      })
      expect(sendSMSMock).toHaveBeenCalled()
    })
    it('should refuse to send an SMS to an already existing user', async () => {
      await clientServer.matrixDb.insert('user_threepids', {
        user_id: '@xg:localhost',
        medium: 'msisdn',
        address: '33648394785',
        validated_at: epoch(),
        added_at: epoch()
      })
      const response = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '0648394785',
          country: 'FR',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_THREEPID_IN_USE')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
  })

  describe('/_matrix/client/v3/account/password/email/requestToken', () => {
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
    it('should refuse an invalid next_link', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/email/requestToken')
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
    it('should refuse a send_attempt that is not a number', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          email: 'yadd@debian.org',
          next_link: 'http://localhost:8090',
          send_attempt: 'NaN'
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid send attempt')
      expect(sendMailMock).not.toHaveBeenCalled()
    })
    it('should refuse a send_attempt that is too large', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          email: 'yadd@debian.org',
          next_link: 'http://localhost:8090',
          send_attempt: 999999999999
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid send attempt')
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

  describe('/_matrix/client/v3/account/password/msisdn/requestToken', () => {
    it('should refuse to register an invalid phone number', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '@yadd:debian.org',
          country: 'FR',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid phone number')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    it('should refuse to register an invalid  country', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '0618384839',
          country: '123',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid country')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    it('should refuse an invalid secret', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'my',
          phone_number: '0618384839',
          country: 'FR',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid client_secret')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    it('should refuse a send_attempt that is not a number', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '0618384839',
          country: 'FR',
          next_link: 'http://localhost:8090',
          send_attempt: 'NaN'
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid send attempt')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    it('should refuse a send_attempt that is too large', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '0618384839',
          country: 'FR',
          next_link: 'http://localhost:8090',
          send_attempt: 999999999999
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid send attempt')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    it('should refuse an invalid next_link', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '0618384839',
          country: 'FR',
          next_link: 'wrong link',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid next_link')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
    // this test is expected to work with the current behaviour of the sendSMS function which is to write in a file, and not to send a real SMS
    it('should accept valid phone number registration query', async () => {
      await clientServer.matrixDb.insert('user_threepids', {
        user_id: '@newphoneuser:localhost',
        medium: 'msisdn',
        address: '447700900002',
        validated_at: epoch(),
        added_at: epoch()
      })

      const response = await request(app)
        .post('/_matrix/client/v3/account/password/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          country: 'GB',
          phone_number: '07700900002',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(200)
      const sentSMS = sendSMSMock.mock.calls[0][0]
      expect(sentSMS.to).toBe('447700900002')
      const rawMessage = sentSMS.raw
      expect(rawMessage).toMatch(
        /token=([a-zA-Z0-9]{64})&client_secret=mysecret&sid=([a-zA-Z0-9]{64})/
      )
      const tokenMatch = rawMessage.match(/token=([a-zA-Z0-9]{64})/)
      const sidMatch = rawMessage.match(/sid=([a-zA-Z0-9]{64})/)
      expect(tokenMatch).not.toBeNull()
      expect(sidMatch).not.toBeNull()
      if (tokenMatch != null) token = tokenMatch[1]
      if (sidMatch != null) sid = sidMatch[1]
    })
    it('should not resend an SMS for the same attempt', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          country: 'GB',
          phone_number: '07700900002',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(200)
      expect(sendSMSMock).not.toHaveBeenCalled()
      expect(response.body).toEqual({
        sid,
        submit_url: getSubmitUrl(clientServer.conf)
      })
    })
    it('should resend an SMS for a different attempt', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          country: 'GB',
          phone_number: '07700900002',
          next_link: 'http://localhost:8090',
          send_attempt: 2
        })
      expect(response.statusCode).toBe(200)
      const sentSMS = sendSMSMock.mock.calls[0][0]
      expect(sentSMS.to).toBe('447700900002')
      const rawMessage = sentSMS.raw
      expect(rawMessage).toMatch(
        /token=([a-zA-Z0-9]{64})&client_secret=mysecret&sid=([a-zA-Z0-9]{64})/
      )
      const sidMatch = rawMessage.match(/sid=([a-zA-Z0-9]{64})/)
      expect(sidMatch).not.toBeNull()
      const newSid = sidMatch[1]
      expect(response.body).toEqual({
        sid: newSid,
        submit_url: getSubmitUrl(clientServer.conf)
      })
      expect(sendSMSMock).toHaveBeenCalled()
    })
    it('should refuse to send an SMS to a non-existing user', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/password/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'mysecret',
          phone_number: '0647392301',
          country: 'FR',
          send_attempt: 1
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_THREEPID_NOT_FOUND')
      expect(sendSMSMock).not.toHaveBeenCalled()
    })
  })
  describe('/_matrix/client/v3/account/3pid/add', () => {
    let sidToAdd: string
    it('should refuse an invalid secret', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/3pid/add')
        .set('Accept', 'application/json')
        .send({
          sid: 'sid',
          client_secret: 'my',
          auth: { type: 'm.login.dummy', session: 'authSession' }
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid client_secret')
    })
    it('should refuse an invalid session ID', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/3pid/add')
        .set('Accept', 'application/json')
        .send({
          sid: '$!:',
          client_secret: 'mysecret',
          auth: { type: 'm.login.dummy', session: 'authSession2' }
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      expect(response.body).toHaveProperty('error', 'Invalid session ID')
    })
    it('should return 400 for a wrong combination of client secret and session ID', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/3pid/add')
        .set('Accept', 'application/json')
        .send({
          sid: 'wrongSid',
          client_secret: 'mysecret',
          auth: { type: 'm.login.dummy', session: 'authSession3' }
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_NO_VALID_SESSION')
    })
    it('should refuse to add a 3pid if the session has not been validated', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/3pid/add')
        .set('Accept', 'application/json')
        .send({
          sid,
          client_secret: 'mysecret',
          auth: { type: 'm.login.dummy', session: 'authSession4' }
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_SESSION_NOT_VALIDATED')
    })
    it('should accept to add a 3pid if the session has been validated', async () => {
      const requestTokenResponse = await request(app)
        .post('/_matrix/client/v3/register/email/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'newsecret',
          email: 'hello@example.com',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      expect(requestTokenResponse.statusCode).toBe(200)
      expect(sendMailMock.mock.calls[0][0].raw).toMatch(
        /token=([a-zA-Z0-9]{64})&client_secret=newsecret&sid=([a-zA-Z0-9]{64})/
      )
      sid = RegExp.$2
      token = RegExp.$1
      const submitTokenResponse = await request(app)
        .post('/_matrix/client/v3/register/email/submitToken')
        .send({
          token,
          client_secret: 'newsecret',
          sid
        })
        .set('Accept', 'application/json')
      expect(submitTokenResponse.statusCode).toBe(200)
      const response = await request(app)
        .post('/_matrix/client/v3/account/3pid/add')
        .set('Accept', 'application/json')
        .send({
          sid,
          client_secret: 'newsecret',
          auth: { type: 'm.login.dummy', session: 'authSession5' }
        })
      expect(response.statusCode).toBe(200)
    })
    it('should accept authentication with m.login.email.identity', async () => {
      const requestTokenResponse = await request(app)
        .post('/_matrix/client/v3/register/msisdn/requestToken')
        .set('Accept', 'application/json')
        .send({
          client_secret: 'othersecret',
          country: 'GB',
          phone_number: '011111111',
          next_link: 'http://localhost:8090',
          send_attempt: 1
        })
      sidToAdd = requestTokenResponse.body.sid
      expect(sendSMSMock.mock.calls[0][0].raw).toMatch(
        /token=([a-zA-Z0-9]{64})&client_secret=othersecret&sid=([a-zA-Z0-9]{64})/
      )
      token = RegExp.$1
      expect(requestTokenResponse.statusCode).toBe(200)
      const submitTokenResponse = await request(app)
        .post('/_matrix/client/v3/register/email/submitToken')
        .send({
          token,
          client_secret: 'othersecret',
          sid: sidToAdd
        })
        .set('Accept', 'application/json')
      expect(submitTokenResponse.statusCode).toBe(200)
      const response = await request(app)
        .post('/_matrix/client/v3/account/3pid/add')
        .set('Accept', 'application/json')
        .send({
          sid: sidToAdd,
          client_secret: 'othersecret',
          auth: {
            type: 'm.login.email.identity',
            session: 'authSession6',
            threepid_creds: { sid, client_secret: 'newsecret' }
          }
        })
      expect(response.statusCode).toBe(200)
    })
    it('should refuse adding a 3pid already associated to another user', async () => {
      const response = await request(app)
        .post('/_matrix/client/v3/account/3pid/add')
        .set('Accept', 'application/json')
        .send({
          sid: sidToAdd,
          client_secret: 'othersecret',
          auth: {
            type: 'm.login.dummy',
            session: 'authSession7'
          }
        })
      expect(response.statusCode).toBe(400)
      expect(response.body).toHaveProperty('errcode', 'M_THREEPID_IN_USE')
    })
  })
})
