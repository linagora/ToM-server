import Middleware from '../middlewares/index.ts'
import type { TwakeLogger } from '@twake-chat/logger'
import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../../../../types.ts'

let mockRequest: Partial<AuthRequest>
let mockResponse: Partial<Response>

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}

const nextFunction: NextFunction = jest.fn()
const middleware = new Middleware(loggerMock as unknown as TwakeLogger)

beforeEach(() => {
  mockRequest = {
    body: {},
    query: {},
    userId: 'test'
  }

  mockResponse = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn()
  }
})

describe('the create room API middleware', () => {
  it('should return a 400 if there is no request body', () => {
    middleware.checkPayload(
      {} as AuthRequest,
      mockResponse as Response,
      nextFunction
    )
    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(nextFunction).not.toHaveBeenCalled()
  })

  it('should return a 400 if the body is empty', async () => {
    middleware.checkPayload(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    )
    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(nextFunction).not.toHaveBeenCalled()
  })

  it('should return 400 if the body is not a json object', () => {
    middleware.checkPayload(
      { body: 'something' } as AuthRequest,
      mockResponse as Response,
      nextFunction
    )

    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(nextFunction).not.toHaveBeenCalled()
  })

  it('should call the next function if the body is acceptable', () => {
    middleware.checkPayload(
      { ...mockRequest, body: { invite: ['@user:server.com'] } } as AuthRequest,
      mockResponse as Response,
      nextFunction
    )

    expect(nextFunction).toHaveBeenCalled()
  })
})
