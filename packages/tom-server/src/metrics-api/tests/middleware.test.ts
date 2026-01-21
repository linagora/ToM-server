import type { AuthRequest } from '../../types.ts'
import type { Response, NextFunction } from 'express'
import Middleware from '../middlewares/index.ts'
import { type MatrixDBBackend } from '@twake-chat/matrix-identity-server'
import { type TwakeLogger } from '@twake-chat/logger'

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

const nextFunction: NextFunction = jest.fn()
const metricsMiddleware = new Middleware(
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

describe('the Metrics API middleware', () => {
  it('should not call the next handler when the user is not administrator', async () => {
    dbMock.get.mockResolvedValue([])

    await metricsMiddleware.checkPermissions(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    )

    expect(nextFunction).not.toHaveBeenCalled()
  })

  it('should call the next handler when the user is administrator', async () => {
    dbMock.get.mockResolvedValue([{ name: 'user', admin: 1 }])

    await metricsMiddleware.checkPermissions(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    )

    expect(nextFunction).toHaveBeenCalled()
  })

  it('should return 403 if the user is not administrator', async () => {
    dbMock.get.mockResolvedValue([])

    await metricsMiddleware.checkPermissions(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    )

    expect(mockResponse.status).toHaveBeenCalledWith(403)
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Forbidden'
    })
  })

  it('should return 400 if something wrong happens', async () => {
    dbMock.get.mockRejectedValue(new Error('Something wrong happened'))

    await metricsMiddleware.checkPermissions(
      {} as unknown as AuthRequest,
      mockResponse as Response,
      nextFunction
    )

    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Bad Request'
    })
  })
})
