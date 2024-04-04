import { type TwakeLogger } from '@twake/logger'
import type { NextFunction, Request, Response } from 'express'
import type { AuthRequest } from '../../types'
import authMiddleware from './auth.middleware'

let mockRequest: Partial<Request>
let mockResponse: Partial<Response>
const nextFunction: NextFunction = jest.fn()
let authMock: (
  req: AuthRequest,
  res: Response,
  cb: (data: any, token: string) => void
) => void

const authenticatorMock = jest
  .fn()
  .mockImplementation(
    (
      req: AuthRequest,
      res: Response,
      callbackMethod: (data: any, token: string) => void
    ) => {
      callbackMethod('test', 'test')
    }
  )

beforeEach(() => {
  mockRequest = {}
  mockResponse = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis()
  }

  jest.spyOn(console, 'error').mockImplementation(() => {})

  authMock = authMiddleware(authenticatorMock, {
    error: jest.fn()
  } as unknown as TwakeLogger) as any
})

describe('the auth middleware', () => {
  it('should call the next handler if the user authenticates', () => {
    authMock(mockRequest as Request, mockResponse as Response, nextFunction)

    expect(nextFunction).toHaveBeenCalled()
  })

  it('should return a 401 if the user does not authenticate: no token found', () => {
    authenticatorMock.mockImplementation(
      (
        req: AuthRequest,
        res: Response,
        callbackMethod: (data: any, token: any) => void
      ) => {
        callbackMethod(undefined, undefined)
      }
    )

    authMock(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(mockResponse.status).toHaveBeenCalledWith(401)
  })

  it('should return a 401 if the user does not authenticate: no sub found', () => {
    authenticatorMock.mockImplementation(
      (
        req: AuthRequest,
        res: Response,
        callbackMethod: (data: any, token: any) => void
      ) => {
        callbackMethod(undefined, 'token')
      }
    )

    authMock(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(mockResponse.status).toHaveBeenCalledWith(401)
  })
})
