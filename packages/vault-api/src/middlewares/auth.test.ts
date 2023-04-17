import { type VaultDbBackend } from '../db/utils'
import { VaultAPIError, type expressAppHandler } from '../utils'
import isAuth, { type tokenDetail } from './auth'
import { type Request, type Response, type NextFunction } from 'express'

interface ITestRequest extends Partial<Request> {
  token?: tokenDetail
}

const token: tokenDetail = {
  value: 'accessTokenddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  content: { sub: 'userId', epoch: 1 }
}

const unauthorizedError = new VaultAPIError('Not Authorized', 401)

describe('Auth middleware', () => {
  const db: Partial<VaultDbBackend> = {
    get: jest.fn().mockResolvedValue([
      {
        id: token.value,
        data: JSON.stringify(token.content)
      }
    ])
  }
  let mockRequest: ITestRequest
  let mockResponse: Partial<Response>
  const nextFunction: NextFunction = jest.fn()

  beforeAll(() => {
    mockRequest = {
      headers: {
        authorization: `Bearer ${token.value}`
      }
    }
    mockResponse = {
      statusCode: undefined,
      status: jest.fn().mockImplementation((code: number) => {
        mockResponse.statusCode = code
        return mockResponse
      }),
      json: jest.fn().mockReturnValue(mockResponse)
    }
  })

  it('should retrieve token from authorization header and store token data in req object', async () => {
    const handler: expressAppHandler = isAuth(db as VaultDbBackend)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockRequest.token).toStrictEqual(token)
  })

  it('should retrieve token from query parameters and store token data in req object', async () => {
    mockRequest = {
      headers: {},
      query: {
        access_token: token.value
      }
    }
    const handler: expressAppHandler = isAuth(db as VaultDbBackend)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockRequest.token).toStrictEqual(token)
  })

  it('should call next function to throw unauthorized error if no entry associated to access_token in database', async () => {
    jest.spyOn(db, 'get').mockResolvedValue([])
    const handler: expressAppHandler = isAuth(db as VaultDbBackend)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(unauthorizedError)
  })

  it('should call next function to throw error if an error occured on retrieving associated entry in database', async () => {
    const errorMsg = 'An error occured in the database'
    jest.spyOn(db, 'get').mockRejectedValue(new Error(errorMsg))
    const handler: expressAppHandler = isAuth(db as VaultDbBackend)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(new Error(errorMsg))
  })

  it('should call next function to throw unauthorized error if request headers and query fields are empty', async () => {
    mockRequest = {
      headers: {},
      query: {}
    }
    const handler: expressAppHandler = isAuth(db as VaultDbBackend)
    expect(() => {
      handler(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrow(unauthorizedError)
  })

  it('should call next function to throw unauthorized error if request headers and query fields are undefined', async () => {
    mockRequest = {
      headers: undefined,
      query: undefined
    }
    const handler: expressAppHandler = isAuth(db as VaultDbBackend)
    expect(() => {
      handler(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrow(unauthorizedError)
  })
})
