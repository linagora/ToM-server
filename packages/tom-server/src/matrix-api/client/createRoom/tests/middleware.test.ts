import Middleware from '../middlewares'
import type { TwakeLogger } from '@twake/logger'
import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../../../../types'

let mockRequest: Partial<AuthRequest>
let mockResponse: Partial<Response>

const loggerMock = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn()
}

const validPresets = [
  'private_chat',
  'public_chat',
  'trusted_private_chat',
  'private_channel',
  'public_channel'
]

const nextFunction: NextFunction = jest.fn()
const middleware = new Middleware(
  loggerMock as unknown as TwakeLogger,
  validPresets,
  'localhost:8008'
)

beforeEach(() => {
  mockRequest = {
    body: {},
    query: {},
    userId: 'test'
  }

  mockResponse = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn()
  }
})

describe('the create room API middleware', () => {
  describe('checkPayload', () => {
    it('should return a 400 M_NOT_JSON if there is no request body', () => {
      middleware.checkPayload(
        {} as AuthRequest,
        mockResponse as Response,
        nextFunction
      )
      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ errcode: 'M_NOT_JSON' })
      )
      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should return a 400 M_NOT_JSON if the body is empty', async () => {
      middleware.checkPayload(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )
      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ errcode: 'M_NOT_JSON' })
      )
      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should return 400 M_NOT_JSON if the body is not a json object', () => {
      middleware.checkPayload(
        { body: 'something' } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ errcode: 'M_NOT_JSON' })
      )
      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should call the next function if the body is acceptable', () => {
      middleware.checkPayload(
        {
          ...mockRequest,
          body: { invite: ['@user:server.com'] }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })
  })

  describe('validatePreset', () => {
    it('should call next if no preset is provided', () => {
      middleware.validatePreset(
        { ...mockRequest, body: { name: 'test' } } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )
      expect(nextFunction).toHaveBeenCalled()
    })

    it('should call next for a valid preset', () => {
      middleware.validatePreset(
        { ...mockRequest, body: { preset: 'private_chat' } } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )
      expect(nextFunction).toHaveBeenCalled()
    })

    it('should return 400 M_BAD_JSON for an invalid preset', () => {
      middleware.validatePreset(
        { ...mockRequest, body: { preset: 'invalid_preset' } } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )
      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        errcode: 'M_BAD_JSON',
        error: 'Invalid preset value'
      })
      expect(nextFunction).not.toHaveBeenCalled()
    })
  })

  describe('bypassIfSpace', () => {
    it('should call next if creation_content is absent', async () => {
      await middleware.bypassIfSpace(
        { ...mockRequest, body: { name: 'test' } } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )
      expect(nextFunction).toHaveBeenCalledWith()
      expect(mockResponse.status).not.toHaveBeenCalled()
    })

    it('should call next if creation_content.type is not m.space', async () => {
      await middleware.bypassIfSpace(
        {
          ...mockRequest,
          body: { creation_content: { type: 'm.room' } }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )
      expect(nextFunction).toHaveBeenCalledWith()
      expect(mockResponse.status).not.toHaveBeenCalled()
    })

    it('should forward the request and return the homeserver response for a space room', async () => {
      const mockFetchResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: '!space:server.com' })
      }
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse)

      await middleware.bypassIfSpace(
        {
          ...mockRequest,
          headers: { authorization: 'Bearer token' },
          body: { creation_content: { type: 'm.space' }, name: 'my space' }
        } as unknown as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/_matrix/client/v3/createRoom'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: JSON.stringify({
            creation_content: { type: 'm.space' },
            name: 'my space'
          })
        })
      )
      expect(mockResponse.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith({
        room_id: '!space:server.com'
      })
      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should call next with the error if fetch throws', async () => {
      const fetchError = new Error('network failure')
      global.fetch = jest.fn().mockRejectedValue(fetchError)

      await middleware.bypassIfSpace(
        {
          ...mockRequest,
          headers: { authorization: 'Bearer token' },
          body: { creation_content: { type: 'm.space' } }
        } as unknown as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalledWith(fetchError)
      expect(mockResponse.status).not.toHaveBeenCalled()
    })
  })
})
