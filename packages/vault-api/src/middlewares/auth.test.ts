import { type VaultDbBackend } from '../db/utils'
import { type Config, VaultAPIError, type expressAppHandler } from '../utils'
import isAuth, { type tokenDetail } from './auth'
import { type Request, type Response, type NextFunction } from 'express'
import fetch from 'node-fetch'

interface ITestRequest extends Partial<Request> {
  token?: tokenDetail
}

const token: tokenDetail = {
  value: 'accessTokenddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  content: { sub: 'userId', epoch: 1 }
}

const matrixServerResponseBody = {
  user_id: 'test',
  is_guest: 'test',
  device_id: 'test'
}

const unauthorizedError = new VaultAPIError('Not Authorized', 401)

describe('Auth middleware', () => {
  const db: Partial<VaultDbBackend> = {
    get: jest.fn().mockResolvedValue([
      {
        id: token.value,
        data: JSON.stringify(token.content)
      }
    ]),
    insert: jest.fn()
  }
  const conf: Partial<Config> = {
    matrix_server: 'localhost'
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
  })

  beforeEach(() => {
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockResolvedValue(matrixServerResponseBody)
    })
    mockRequest.token = undefined
    jest.clearAllMocks()
  })

  it('should retrieve token from authorization header and store token data in req object', async () => {
    const handler: expressAppHandler = isAuth(
      db as VaultDbBackend,
      conf as Config
    )
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
    const handler: expressAppHandler = isAuth(
      db as VaultDbBackend,
      conf as Config
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockRequest.token).toStrictEqual(token)
  })

  it('should add access_token in database if no entry found and user is already authenticated on matrix server', async () => {
    jest.spyOn(db, 'get').mockResolvedValue([])
    const handler: expressAppHandler = isAuth(
      db as VaultDbBackend,
      conf as Config
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(db.insert).toHaveBeenCalled()
    expect(mockRequest.token?.value).toEqual(token.value)
    expect(mockRequest.token?.content.sub).toEqual(
      matrixServerResponseBody.user_id
    )
    expect(nextFunction).toHaveBeenCalled()
  })

  it('should call next function to throw unauthorized error if user is not authenticated on matrix server', async () => {
    jest.spyOn(db, 'get').mockResolvedValue([])
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest
        .fn()
        .mockResolvedValue({ ...matrixServerResponseBody, user_id: null })
    })
    const handler: expressAppHandler = isAuth(
      db as VaultDbBackend,
      conf as Config
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(db.insert).not.toHaveBeenCalled()
    expect(nextFunction).toHaveBeenCalledWith(unauthorizedError)
    expect(mockRequest.token).toBeUndefined()
  })

  it('should call next function to throw error if insert access_token in database failed', async () => {
    const errorDb = new Error('An error occured in the database')
    jest.spyOn(db, 'get').mockResolvedValue([])
    jest.spyOn(db, 'insert').mockRejectedValue(errorDb)
    const handler: expressAppHandler = isAuth(
      db as VaultDbBackend,
      conf as Config
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(errorDb)
    expect(mockRequest.token).toBeUndefined()
  })

  it('should call next function to throw error if request to Matrix server failed', async () => {
    const errorMatrixServer = new Error('An error occured with Matrix Server')
    jest.spyOn(db, 'get').mockResolvedValue([])
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockRejectedValue(errorMatrixServer)
    })
    const handler: expressAppHandler = isAuth(
      db as VaultDbBackend,
      conf as Config
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(db.insert).not.toHaveBeenCalled()
    expect(nextFunction).toHaveBeenCalledWith(errorMatrixServer)
    expect(mockRequest.token).toBeUndefined()
  })

  it('should call next function to throw error if an error occured on retrieving associated entry in database', async () => {
    const errorDb = new Error('An error occured in the database')
    jest.spyOn(db, 'get').mockRejectedValue(errorDb)
    const handler: expressAppHandler = isAuth(
      db as VaultDbBackend,
      conf as Config
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(errorDb)
    expect(mockRequest.token).toBeUndefined()
  })

  it('should call next function to throw unauthorized error if request headers and query fields are empty', async () => {
    mockRequest = {
      headers: {},
      query: {}
    }
    const handler: expressAppHandler = isAuth(
      db as VaultDbBackend,
      conf as Config
    )
    expect(() => {
      handler(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrow(unauthorizedError)
  })

  it('should call next function to throw unauthorized error if request headers and query fields are undefined', async () => {
    mockRequest = {
      headers: undefined,
      query: undefined
    }
    const handler: expressAppHandler = isAuth(
      db as VaultDbBackend,
      conf as Config
    )
    expect(() => {
      handler(mockRequest as Request, mockResponse as Response, nextFunction)
    }).toThrow(unauthorizedError)
  })
})
