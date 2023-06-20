import type { Response, Request, NextFunction } from 'express'
import requireLdapMiddleware from '../middlewares/require-ldap'
import type { Config } from '../../types'

let mockRequest: Partial<Request>
let mockResponse: Partial<Response>
const mockNext: NextFunction = jest.fn()

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => null)

  mockRequest = {}
  mockResponse = {
    send: jest.fn(),
    status: jest.fn().mockReturnThis()
  }
})

afterEach(() => jest.clearAllMocks())

describe('the check LDAP middleware', () => {
  it('should call the next handler if the user database engine is ldap', () => {
    const middleware = requireLdapMiddleware({
      userdb_engine: 'ldap'
    } as unknown as Config)

    middleware(mockRequest as Request, mockResponse as Response, mockNext)

    expect(mockNext).toHaveBeenCalled()
  })

  it('should return 500 if the user database engine is not ldap', () => {
    const middleware = requireLdapMiddleware({
      userdb_engine: 'pg'
    } as unknown as Config)

    middleware(mockRequest as Request, mockResponse as Response, mockNext)

    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockNext).not.toHaveBeenCalled()
  })
})
