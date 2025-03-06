import type { AuthRequest, Config } from '../../types'
import type { Response, NextFunction } from 'express'
import Middleware from '../middlewares'
import { type MatrixDBBackend } from '@twake/matrix-identity-server'
import { type TwakeLogger } from '@twake/logger'

let mockRequest: Partial<AuthRequest>
let mockResponse: Partial<Response>

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

const mockConfig = {
  admin_access_token: 'secret'
}

const nextFunction: NextFunction = jest.fn()
const middleware = new Middleware(
  mockConfig as unknown as Config,
  dbMock as unknown as MatrixDBBackend,
  loggerMock as unknown as TwakeLogger
)

beforeEach(() => {
  mockRequest = {
    body: {},
    query: {},
    userId: 'test'
  }

  mockResponse = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis()
  }
})

describe('the deactive user API middleware', () => {
  describe('the checkAccessToken middleware', () => {
    it('should not call the next handler if the user did not provide the access token header', () => {
      middleware.checkAccessToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should not call the next handler if the provided access token is wrong', () => {
      middleware.checkAccessToken(
        {
          ...mockRequest,
          headers: {
            'x-access-token': 'wrong'
          }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should call the next handler if the user provided the correct access token', () => {
      middleware.checkAccessToken(
        {
          ...mockRequest,
          headers: {
            'x-access-token': 'secret'
          }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })
  })

  describe('the checkUserExists middleware', () => {
    it('should not call the next handler if the user id is not present in request params', async () => {
      await middleware.checkUserExists(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Missing user ID'
      })
    })

    it('should not call the next handler if the user is already marked as erased', async () => {
      dbMock.get.mockResolvedValue([
        {
          user_id: '@test:domain.com'
        }
      ])

      await middleware.checkUserExists(
        {
          ...mockRequest,
          params: {
            id: '@test:domain.com'
          }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'User is already erased'
      })
    })

    it('should not call the next handler if the user is not found', async () => {
      dbMock.get.mockResolvedValue([])

      await middleware.checkUserExists(
        {
          ...mockRequest,
          params: {
            id: '@test:domain.com'
          }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(404)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'User not found'
      })
    })

    it('should not call the next handler if the user is already deactivated', async () => {
      dbMock.get.mockImplementation((table) => {
        if (table === 'users') {
          return [
            {
              deactivated: 1
            }
          ]
        }

        return []
      })

      await middleware.checkUserExists(
        {
          ...mockRequest,
          params: {
            id: '@test:domain.com'
          }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'User is already deactivated'
      })
    })

    it('should call the next handler if the user is not deactivated', async () => {
      dbMock.get.mockImplementation((table) => {
        if (table === 'users') {
          return [
            {
              deactivated: 0
            }
          ]
        }

        return []
      })

      await middleware.checkUserExists(
        {
          ...mockRequest,
          params: {
            id: '@test:domain.com'
          }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
      expect(mockResponse.status).not.toHaveBeenCalled()
      expect(mockResponse.json).not.toHaveBeenCalled()
    })
  })
})
