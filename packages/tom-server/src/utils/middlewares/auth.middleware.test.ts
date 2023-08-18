/* eslint-disable n/no-callback-literal */
import { type TwakeLogger } from '@twake/logger'
import type { NextFunction, Request, Response } from 'express'
import type { AuthRequest, Config, IdentityServerDb } from '../../types'
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
    () =>
      (
        req: AuthRequest,
        res: Response,
        cb: (data: any, token: string) => void
      ) => {
        cb('test', 'test')
      }
  )

jest.mock('../../identity-server/utils/authenticate.ts', () => {
  return (db: IdentityServerDb, conf: Config) => authenticatorMock(db, conf)
})

beforeEach(() => {
  mockRequest = {}
  mockResponse = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis()
  }

  jest.spyOn(console, 'error').mockImplementation(() => {})

  authMock = authMiddleware(
    {} as unknown as IdentityServerDb,
    {} as unknown as Config,
    { error: jest.fn() } as unknown as TwakeLogger
  ) as any
})

describe('the auth middleware', () => {
  it('should call the next handler if the user authenticates', () => {
    authMock(mockRequest as Request, mockResponse as Response, nextFunction)

    expect(nextFunction).toHaveBeenCalled()
  })

  it('should return a 401 if the user does not authenticate: no token found', () => {
    authenticatorMock.mockImplementation(
      () =>
        (
          req: AuthRequest,
          res: Response,
          cb: (data: any, token: any) => void
        ) => {
          cb(undefined, undefined)
        }
    )

    authMock(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(mockResponse.status).toHaveBeenCalledWith(401)
  })

  it('should return a 401 if the user does not authenticate: no sub found', () => {
    authenticatorMock.mockImplementation(
      () =>
        (
          req: AuthRequest,
          res: Response,
          cb: (data: any, token: any) => void
        ) => {
          cb(undefined, 'token')
        }
    )

    authMock(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(mockResponse.status).toHaveBeenCalledWith(401)
  })
})
