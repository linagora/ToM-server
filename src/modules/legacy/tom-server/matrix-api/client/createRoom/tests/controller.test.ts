import { describe, expect, it, mock, test } from 'bun:test'
import express, { type NextFunction } from 'express'
import bodyParser from 'body-parser'
import { TwakeLogger } from '../../../../../logger'
import type {
  AuthenticationFunction,
  AuthRequest,
  Config,
  CreateRoomPayload
} from '../../../../types'
import router from '../routes'
import supertest from 'supertest'

const loggerMock = {
  error: mock(),
  warn: mock(),
  info: mock(),
  debug: mock(),
  silly: mock()
}

mock.module('../middlewares/index.ts', () => {
  const passiveMiddlewareMock = (
    _req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    next()
  }

  return {
    default: function () {
      return {
        checkPayload: passiveMiddlewareMock,
        bypassIfSpace: passiveMiddlewareMock,
        validatePreset: passiveMiddlewareMock
      }
    }
  }
})

const mockCreate = mock()

mock.module('../services/index.ts', () => {
  return {
    default: function () {
      return {
        create: mockCreate
      }
    }
  }
})

const mockAuthenticationFunction: AuthenticationFunction = (
  req,
  res,
  callback,
  requiresTerms
) => {
  // Attach mock user ID on the request object
  // Must cast req as any because it's typed as IncomingMessage | Request
  ;(req as any).userId = '@user:server.com'

  const mockTokenContent = {
    user_id: '@user:server.com',
    name: 'Test User',
    sub: '@user:server.com',
    epoch: 1000000
  }

  callback(mockTokenContent, '@user:server.com')
}

const app = express()

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
    mockAuthenticationFunction,
    loggerMock as unknown as TwakeLogger
  )
)

describe('the createRoom controller', () => {
  describe('the createRoom method', () => {
    it('should call the room service to create a room', async () => {
      await supertest(app)
        .post('/')
        .send({
          invite: ['@test:example.com'],
          name: 'test',
          visibility: 'private'
        } satisfies Partial<CreateRoomPayload>)
        .set('Authorization', 'Bearer test')

      expect(mockCreate).toHaveBeenCalledWith(
        {
          invite: ['@test:example.com'],
          name: 'test',
          visibility: 'private'
        } satisfies Partial<CreateRoomPayload>,
        'Bearer test',
        '@user:server.com'
      )
    })

    it('should return the reponse ( status and data ) of the service', async () => {
      mockCreate.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ room_id: 'test' })
      })

      const response = await supertest(app)
        .post('/')
        .send({
          invite: ['@test:example.com'],
          name: 'test',
          visibility: 'private'
        } satisfies Partial<CreateRoomPayload>)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        room_id: 'test'
      })
    })

    it('should return 500 if something wrong happens', async () => {
      mockCreate.mockRejectedValueOnce(new Error('test'))

      const response = await supertest(app)
        .post('/')
        .send({
          invite: ['@test:example.com'],
          name: 'test',
          visibility: 'private'
        } satisfies Partial<CreateRoomPayload>)
        .set('Authorization', 'Bearer test')

      expect(response.status).toBe(500)
    })

    it('should return 400 if authorization header is missing', async () => {
      const response = await supertest(app)
        .post('/')
        .send({
          invite: ['@test:example.com'],
          name: 'test',
          visibility: 'private'
        } satisfies Partial<CreateRoomPayload>)

      expect(response.status).toBe(400)
    })
  })
})
