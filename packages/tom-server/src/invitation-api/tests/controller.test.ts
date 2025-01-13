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
    callbackMethod('test', 'test')
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
      rateLimitInvitations: passiveMiddlewareMock
    }
  }
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  router(
    { matrix_server: 'http://localhost:789' } as unknown as Config,
    dbMock as unknown as TwakeDB,
    authenticatorMock,
    loggerMock as unknown as TwakeLogger
  )
)

describe('the invitation API controller', () => {
  describe('the sendInvitation method', () => {
    it('should try to send an invitation', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })

      const response = await supertest(app)
        .post(PATH)
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(200)
    })

    it('should store the invitation in the db', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })

      await supertest(app)
        .post(PATH)
        .set('Authorization', 'Bearer test')
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)

      expect(dbMock.insert).toHaveBeenCalledWith(
        'invitations',
        expect.any(Object)
      )
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

    it('should return a 500 if the fetch to matrix server fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('test'))

      const response = await supertest(app)
        .post(PATH)
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(500)
    })

    it('should return a 500 if the db insert fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })
      dbMock.insert.mockRejectedValue(new Error('test'))

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
    it('should try to accept an invitation', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recepient: 'test',
          medium: 'phone',
          expiration: `${Date.now() + EXPIRATION}`,
          accessed: 0,
          room_id: 'test'
        }
      ])

      const response = await supertest(app).get(`${PATH}/test`)

      expect(response.status).toBe(301)
    })

    it('should try to update the invitation status in db', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recepient: 'test',
          medium: 'phone',
          expiration: `${Date.now() + EXPIRATION}`,
          accessed: 0,
          room_id: 'test'
        }
      ])

      await supertest(app).get(`${PATH}/test`)

      expect(dbMock.update).toHaveBeenCalledWith(
        'invitations',
        { accessed: 1 },
        'id',
        'test'
      )
    })

    it('should return a 500 if the invitation is expired', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recepient: 'test',
          medium: 'phone',
          expiration: `${Date.now() - EXPIRATION}`,
          accessed: 0
        }
      ])

      const response = await supertest(app).get(`${PATH}/test`)

      expect(response.status).toBe(500)
    })

    it('should return a 500 if the invitation does not exist', async () => {
      dbMock.get.mockResolvedValue([])

      const response = await supertest(app).get(`${PATH}/test`)

      expect(response.status).toBe(500)
    })

    it('should create a room if the invitation does not have a room_id', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recepient: 'test',
          medium: 'phone',
          expiration: `${Date.now() + EXPIRATION}`,
          accessed: 0
        }
      ])

      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })

      await supertest(app).get(`${PATH}/test`)

      expect(dbMock.update).toHaveBeenCalledWith(
        'invitations',
        { accessed: 1, room_id: 'test' },
        'id',
        'test'
      )
    })
  })

  describe('the listInvitations method', () => {
    it('should return the list of invitations', async () => {
      const sampleInvitation = {
        id: 'test',
        sender: 'test',
        recepient: 'test',
        medium: 'phone',
        expiration: `${Date.now() + EXPIRATION}`,
        accessed: 0
      }

      dbMock.get.mockResolvedValue([sampleInvitation])

      const response = await supertest(app)
        .get(`${PATH}/list`)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        invitations: [{ ...sampleInvitation, accessed: false }]
      })
    })

    it('should return a 500 if the db fails to get the invitations', async () => {
      dbMock.get.mockRejectedValue(new Error('test'))

      const response = await supertest(app)
        .get(`${PATH}/list`)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(500)
    })
  })

  describe('the generateInvitationLink method', () => {
    it('should attempt to generate an invitation link', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })

      dbMock.insert.mockResolvedValue({ id: 'test' })
      const response = await supertest(app)
        .post(`${PATH}/generate`)
        .set('Authorization', 'Bearer test')
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ link: expect.any(String) })
    })

    it('should attempt to save the invitation in the db', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })
      dbMock.insert.mockResolvedValue({ id: 'test' })

      await supertest(app)
        .post(`${PATH}/generate`)
        .set('Authorization', 'Bearer test')
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)

      expect(dbMock.insert).toHaveBeenCalledWith(
        'invitations',
        expect.any(Object)
      )
    })

    it('should return a 500 if the db insert fails', async () => {
      dbMock.insert.mockRejectedValue(new Error('test'))

      const response = await supertest(app)
        .post(`${PATH}/generate`)
        .set('Authorization', 'Bearer test')
        .send({
          contact: '+21625555888',
          medium: 'phone'
        } satisfies InvitationRequestPayload)

      expect(response.status).toBe(500)
    })
  })
})
