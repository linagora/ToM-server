import { TwakeLogger } from '@twake/logger'
import bodyParser from 'body-parser'
import express, { NextFunction } from 'express'
import router, { PATH } from '../routes'
import type { AuthRequest, Config, TwakeDB } from '../../types'
import supertest from 'supertest'
import { InvitationRequestPayload } from '../types'

const EXPIRATION = 24 * 60 * 60 * 1000 // 24 hours

const app = express()

const dbMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}

const authenticatorMock = jest
  .fn()
  .mockImplementation((_req, _res, callbackMethod) => {
    callbackMethod({ sub: 'test' }, 'test')
  })

jest.mock('../middlewares/index.ts', () => {
  const passiveMiddlewareMock = (
    _req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    next()
  }

  return function () {
    return {
      checkInvitationPayload: passiveMiddlewareMock,
      checkInvitation: passiveMiddlewareMock,
      rateLimitInvitations: passiveMiddlewareMock,
      checkInvitationOwnership: passiveMiddlewareMock,
      checkGenerateInvitationLinkPayload: passiveMiddlewareMock,
      checkFeatureEnabled: passiveMiddlewareMock
    }
  }
})

jest.mock('../../utils/middlewares/cookie-auth.middleware', () => {
  const passiveMiddlewareMock = (
    _req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    next()
  }

  return function () {
    return {
      authenticateWithCookie: passiveMiddlewareMock
    }
  }
})

const spyMock = jest.fn()

jest.mock('../services/index.ts', () => {
  return function () {
    return {
      invite: spyMock,
      accept: spyMock,
      list: spyMock,
      generateLink: spyMock,
      getInvitationStatus: spyMock,
      removeInvitation: spyMock
    }
  }
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  router(
    {
      matrix_server: 'http://localhost:789',
      base_url: 'http://localhost',
      signup_url: 'http://example.com/?app=chat',
      sms_api_url: 'http://sms.example.com/api'
    } as unknown as Config,
    dbMock as unknown as TwakeDB,
    authenticatorMock,
    loggerMock as unknown as TwakeLogger
  )
)

describe('the invitation API controller', () => {
  describe('the sendInvitation method', () => {
    it('should try to send an invitation', async () => {
      const response = await supertest(app)
        .post(PATH)
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)
        .set('Authorization', 'Bearer test')

      expect(spyMock).toHaveBeenCalledWith({
        recipient: '+21625555888',
        medium: 'phone',
        sender: 'test'
      })

      expect(response.status).toBe(200)
    })

    it('should return a 400 if the sender is missing', async () => {
      const response = await supertest(app)
        .post(PATH)
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)

      expect(response.status).toBe(400)
    })

    it('should return a 400 if the authorization header is missing', async () => {
      const response = await supertest(app)
        .post(PATH)
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)

      expect(response.status).toBe(400)
    })

    it('should return a 500 if something wrong happens', async () => {
      spyMock.mockRejectedValue(new Error('test'))

      const response = await supertest(app)
        .post(PATH)
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(500)
    })
  })

  describe('the acceptInvitation method', () => {
    afterEach(() => {
      spyMock.mockClear()
    })

    it('should try to accept an invitation', async () => {
      spyMock.mockClear()
      spyMock.mockResolvedValue('Invitation accepted')

      const response = await supertest(app)
        .get(`${PATH}/token`)
        .set('Authorization', 'Bearer test')

      expect(spyMock).toHaveBeenCalledWith('token', 'test', 'Bearer test')
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ message: 'Invitation accepted' })
    })

    it('should return a 500 if something wrong happens', async () => {
      spyMock.mockClear()
      spyMock.mockRejectedValue(new Error('something wrong happens'))

      const response = await supertest(app)
        .get(`${PATH}/test`)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(500)
    })

    it('should return a 400 if the authorization header is missing', async () => {
      const response = await supertest(app).get(`${PATH}/token`)

      expect(response.status).toBe(400)
      expect(response.body).toEqual({
        message: 'Authorization header is required'
      })
    })
  })

  describe('the listInvitations method', () => {
    it('should return the list of invitations', async () => {
      const sampleInvitation = {
        id: 'test',
        sender: 'test',
        recipient: 'test',
        medium: 'phone',
        expiration: Date.now() + EXPIRATION,
        accessed: false
      }

      spyMock.mockResolvedValue([sampleInvitation])

      const response = await supertest(app)
        .get(`${PATH}/list`)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        invitations: [sampleInvitation]
      })
    })

    it('should return a 500 if something wrong happens', async () => {
      spyMock.mockRejectedValue(new Error('error'))

      const response = await supertest(app)
        .get(`${PATH}/list`)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(500)
    })
  })

  describe('the generateInvitationLink method', () => {
    it('should attempt to generate an invitation link', async () => {
      spyMock.mockResolvedValue({
        link: 'https://localhost/?invitation_token=test',
        id: 'test'
      })

      const response = await supertest(app)
        .post(`${PATH}/generate`)
        .set('Authorization', 'Bearer test')
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ link: expect.any(String), id: 'test' })
    })

    it('should return a 500 if something wrong happens', async () => {
      spyMock.mockRejectedValue(new Error('error'))

      const response = await supertest(app)
        .post(`${PATH}/generate`)
        .set('Authorization', 'Bearer test')
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)

      expect(response.status).toBe(500)
    })

    describe('without 3pid ( unknown user )', () => {
      it('should generate an invitation link without a body', async () => {
        spyMock.mockResolvedValue({
          link: 'https://localhost/?invitation_token=test',
          id: 'test'
        })

        const response = await supertest(app)
          .post(`${PATH}/generate`)
          .set('Authorization', 'Bearer test')
          .send()

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
          link: expect.any(String),
          id: 'test'
        })
      })

      it('should generate an invitation link with an empty body', async () => {
        spyMock.mockResolvedValue({
          link: 'https://localhost/?invitation_token=test',
          id: 'test'
        })

        const response = await supertest(app)
          .post(`${PATH}/generate`)
          .set('Authorization', 'Bearer test')
          .send({})

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
          link: expect.any(String),
          id: 'test'
        })
      })
    })
  })

  describe('the getInvitationStatus method', () => {
    it('should attempt to get the invitation status', async () => {
      spyMock.mockResolvedValue({
        id: 'test',
        sender: 'test',
        recipient: 'test',
        medium: 'phone',
        expiration: `${EXPIRATION}`,
        accessed: false
      })

      const response = await supertest(app)
        .get(`${PATH}/test/status`)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        invitation: {
          id: 'test',
          sender: 'test',
          recipient: 'test',
          medium: 'phone',
          expiration: `${EXPIRATION}`,
          accessed: false
        }
      })
    })

    it('should return a 500 if something wrong happens', async () => {
      spyMock.mockRejectedValue(new Error('error'))

      const response = await supertest(app)
        .get(`${PATH}/test/status`)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(500)
    })
  })

  describe('the removeInvitation method', () => {
    it('should attempt to remove an invitation', async () => {
      spyMock.mockResolvedValue('Invitation removed')

      const response = await supertest(app)
        .delete(`${PATH}/test`)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ message: 'Invitation removed' })
    })

    it('should return a 500 if something wrong happens', async () => {
      spyMock.mockRejectedValue(new Error('error'))

      const response = await supertest(app)
        .delete(`${PATH}/test`)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(500)
    })
  })
})
