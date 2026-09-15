import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { type TwakeLogger } from '../../../logger'
import type { NextFunction, Request, Response } from 'express'
import type { Config } from '../../types'
import requireLdapMiddleware from '../middlewares/require-ldap'

let mockRequest: Partial<Request>
let mockResponse: Partial<Response>
const mockNext: NextFunction = mock()
const mockLogger: Partial<TwakeLogger> = { error: mock() }

beforeEach(() => {
  mockRequest = {}
  mockResponse = {
    send: mock(),
    status: mock().mockReturnThis()
  }
})

afterEach(() => mock.clearAllMocks())

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
