import { type TwakeLogger } from '@twake/logger'
import type { NextFunction, Request, Response } from 'express'
import type { Config } from '../../types'
import requireLdapMiddleware from '../middlewares/require-ldap'

let mockRequest: Partial<Request>
let mockResponse: Partial<Response>
const mockNext: NextFunction = jest.fn()
const mockLogger: Partial<TwakeLogger> = { error: jest.fn() }

beforeEach(() => {
  mockRequest = {}
  mockResponse = {
    send: jest.fn(),
    status: jest.fn().mockReturnThis()
  }
})

afterEach(() => jest.clearAllMocks())

describe('the check LDAP middleware', () => {
  it('should call the next handler if the user database engine is ldap', () => {
    const middleware = requireLdapMiddleware(
      {
        userdb_engine: 'ldap'
      } as unknown as Config,
      mockLogger as TwakeLogger
    )

    middleware(mockRequest as Request, mockResponse as Response, mockNext)

    expect(mockNext).toHaveBeenCalled()
  })

  it('should return 500 if the user database engine is not ldap', () => {
    const middleware = requireLdapMiddleware(
      {
        userdb_engine: 'pg'
      } as unknown as Config,
      mockLogger as TwakeLogger
    )

    middleware(mockRequest as Request, mockResponse as Response, mockNext)

    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockNext).not.toHaveBeenCalled()
  })
})
