import { type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import testConfig from '../__testData__/config.json'
import { AppServerAPIError, errCodes, type expressAppHandler } from '../utils'
import auth from './auth'

const homeserverToken =
  'hsTokenTestwdakZQunWWNe3DZitAerw9aNqJ2a6HVp0sJtg7qTJWXcHnBjgN0NL'

const unauthorizedError = new AppServerAPIError({
  status: 401,
  code: errCodes.unauthorized
})

const forbiddenError = new AppServerAPIError({
  status: 403,
  code: errCodes.forbidden
})

const rateLimiter = rateLimit({
  windowMs: testConfig.rate_limiting_window,
  limit: testConfig.rate_limiting_nb_requests
})

describe('Authentication', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let nextFunction: NextFunction
  beforeEach(() => {
    mockRequest = {
      headers: {
        authorization: `Bearer ${homeserverToken}`
      },
      ip: '192.168.0.1'
    }
    nextFunction = jest.fn()
  })

  it('should call next function when the auth method parameter matches the token in authorization header', () => {
    const handler: expressAppHandler = auth(homeserverToken, rateLimiter)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(nextFunction).toHaveBeenCalledTimes(1)
    expect(nextFunction).toHaveBeenCalled()
  })

  it('should throw AppServerAPIError with 401 status if headers is undefined in request object', () => {
    mockRequest = {}
    const handler: expressAppHandler = auth(homeserverToken, rateLimiter)
    expect(() => {
      handler(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrowError(unauthorizedError)
  })

  it('should throw AppServerAPIError with 401 status if authorization header is undefined in request object', () => {
    mockRequest = {
      headers: {}
    }
    const handler: expressAppHandler = auth(homeserverToken, rateLimiter)
    expect(() => {
      handler(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrowError(unauthorizedError)
  })

  it('should throw AppServerAPIError with 403 status if authorization token does not match regex', () => {
    mockRequest = {
      headers: {
        authorization: `Bearer falsy_token`
      }
    }
    const handler: expressAppHandler = auth(homeserverToken, rateLimiter)
    expect(() => {
      handler(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrowError(forbiddenError)
  })

  it('should throw AppServerAPIError with 403 status if authorization token does not match expected token value', () => {
    const handler: expressAppHandler = auth('expected_token_value', rateLimiter)
    expect(() => {
      handler(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrowError(forbiddenError)
  })
})
