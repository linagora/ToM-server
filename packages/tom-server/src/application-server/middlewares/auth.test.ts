import { AppServerAPIError } from '@twake/matrix-application-server'
import { auth } from './auth'
import { type Request, type Response, type NextFunction } from 'express'

const adminToken =
  'adTokenTestwdakZQunWWNe3DZitAerw9aNqJ2a6HVp0sJtg7qTJWXcHnBjgN0NL'

const unauthorizedError = new AppServerAPIError({
  status: 401,
  message: 'Not authorized'
})

const forbiddenError = new AppServerAPIError({
  status: 403,
  message: 'Forbidden'
})

describe('Authentication', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  const nextFunction: NextFunction = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequest = {
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    }
  })

  it('should call next function when the auth method parameter matches the token in authorization header', () => {
    auth(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(nextFunction).toHaveBeenCalled()
  })

  it('should throw AppServerAPIError with 401 status if headers is undefined in request object', () => {
    mockRequest = {}
    expect(() => {
      auth(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrowError(unauthorizedError)
  })

  it('should throw AppServerAPIError with 401 status if authorization header is undefined in request object', () => {
    mockRequest = {
      headers: {}
    }
    expect(() => {
      auth(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrowError(unauthorizedError)
  })

  it('should throw AppServerAPIError with 403 status if authorization token does not match regex', () => {
    mockRequest = {
      headers: {
        authorization: `Bearer falsy_token`
      }
    }
    expect(() => {
      auth(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrowError(forbiddenError)
  })
})
