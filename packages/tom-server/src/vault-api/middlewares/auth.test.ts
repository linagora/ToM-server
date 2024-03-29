import { getLogger } from '@twake/logger'
import { type NextFunction, type Request, type Response } from 'express'
import fetch from 'node-fetch'
import { type TwakeDB } from '../../db'
import { type Config } from '../../types'
import { type expressAppHandler } from '../utils'
import isAuth, { type tokenDetail } from './auth'

interface ITestRequest extends Partial<Request> {
  token?: tokenDetail
}

const token: tokenDetail = {
  value: 'accessTokenddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  content: { sub: 'userId', epoch: 1 }
}

const matrixUnauthorizedError = {
  errcode: 'M_UNAUTHORIZED',
  error: 'Unauthorized'
}

const matrixServerResponseBody = {
  user_id: 'test',
  is_guest: 'test',
  device_id: 'test'
}

const logger = getLogger()

describe('Auth middleware', () => {
  let spyOnLoggerWarn: jest.SpyInstance
  let spyOnLoggerDebug: jest.SpyInstance
  let spyOnLoggerError: jest.SpyInstance

  const db: Partial<TwakeDB> = {
    get: jest
      .fn()
      .mockResolvedValue([
        { id: token.value, data: JSON.stringify(token.content) }
      ]),
    insert: jest
      .fn()
      .mockResolvedValue([
        { id: token.value, data: JSON.stringify(token.content) }
      ])
  }
  const conf: Partial<Config> = {
    matrix_server: 'localhost'
  }
  let mockRequest: ITestRequest
  let mockResponse: Partial<Response>
  const nextFunction: NextFunction = jest.fn()
  beforeAll(() => {
    mockResponse = {
      writeHead: jest.fn(),
      write: jest.fn(),
      send: jest.fn(),
      end: jest.fn()
    }
    spyOnLoggerWarn = jest.spyOn(logger, 'warn')
    spyOnLoggerDebug = jest.spyOn(logger, 'debug')
    spyOnLoggerError = jest.spyOn(logger, 'error')
  })

  beforeEach(() => {
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockResolvedValue(matrixServerResponseBody)
    })
    mockRequest = {
      headers: {
        authorization: `Bearer ${token.value}`
      }
    }
    mockRequest.token = undefined
    jest.clearAllMocks()
  })

  afterAll(() => {
    logger.close()
  })

  it('should retrieve token from authorization header and store token data in req object', async () => {
    const handler: expressAppHandler = isAuth(
      db as TwakeDB,
      conf as Config,
      logger
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
      db as TwakeDB,
      conf as Config,
      logger
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockRequest.token).toStrictEqual(token)
  })

  it('should add access_token in database if no entry found and user is already authenticated on matrix server', async () => {
    jest.spyOn(db, 'get').mockResolvedValue([])
    const handler: expressAppHandler = isAuth(
      db as TwakeDB,
      conf as Config,
      logger
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(db.insert).toHaveBeenCalled()
    expect(mockRequest.token?.value).toEqual(token.value)
    expect(mockRequest.token?.content.sub).toEqual(
      matrixServerResponseBody.user_id
    )
  })

  it('should retrieve token from matrix server if an error occured on retrieving associated entry in database', async () => {
    const errorDb = new Error('An error occured in the database')
    jest.spyOn(db, 'get').mockRejectedValue(errorDb)
    const handler: expressAppHandler = isAuth(
      db as TwakeDB,
      conf as Config,
      logger
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(db.insert).toHaveBeenCalled()
    expect(mockRequest.token?.value).toEqual(token.value)
    expect(mockRequest.token?.content.sub).toEqual(
      matrixServerResponseBody.user_id
    )
  })

  it('should send response with 401 unauthorized error if authorization header value does not match regex', async () => {
    mockRequest = {
      headers: {
        authorization: 'falsy_token'
      },
      query: {}
    }
    const handler: expressAppHandler = isAuth(
      db as TwakeDB,
      conf as Config,
      logger
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(spyOnLoggerWarn).toHaveBeenCalledWith('Access tried without token', {
      authorization: 'falsy_token'
    })
    expect(mockResponse.write).toHaveBeenCalledWith(
      JSON.stringify(matrixUnauthorizedError)
    )
    expect(mockRequest.token).toBeUndefined()
  })

  it('should send response with 401 unauthorized error if access_token in query parameters is undefined', async () => {
    mockRequest = {
      headers: {},
      query: {
        access_token: undefined
      }
    }
    const handler: expressAppHandler = isAuth(
      db as TwakeDB,
      conf as Config,
      logger
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(spyOnLoggerWarn).toHaveBeenCalledWith(
      'Access tried without token',
      {}
    )
    expect(mockResponse.write).toHaveBeenCalledWith(
      JSON.stringify(matrixUnauthorizedError)
    )
    expect(mockRequest.token).toBeUndefined()
  })

  it('should send response with 401 unauthorized error if request headers and query fields are empty', async () => {
    mockRequest = {
      headers: {},
      query: {}
    }
    const handler: expressAppHandler = isAuth(
      db as TwakeDB,
      conf as Config,
      logger
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(spyOnLoggerWarn).toHaveBeenCalledWith(
      'Access tried without token',
      {}
    )
    expect(mockResponse.write).toHaveBeenCalledWith(
      JSON.stringify(matrixUnauthorizedError)
    )
    expect(mockRequest.token).toBeUndefined()
  })

  it('should send response with 401 unauthorized error if request headers and query fields are undefined', async () => {
    mockRequest = {
      headers: undefined,
      query: undefined
    }
    const handler: expressAppHandler = isAuth(
      db as TwakeDB,
      conf as Config,
      logger
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(mockResponse.write).toHaveBeenCalledWith(
      JSON.stringify(matrixUnauthorizedError)
    )
    expect(mockRequest.token).toBeUndefined()
  })

  it('should send response with 401 unauthorized error if request to Matrix server failed', async () => {
    const errorMatrixServer = new Error('An error occured with Matrix Server')
    jest.spyOn(db, 'get').mockResolvedValue([])
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockRejectedValue(errorMatrixServer)
    })
    const handler: expressAppHandler = isAuth(
      db as TwakeDB,
      conf as Config,
      logger
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(db.insert).not.toHaveBeenCalled()
    expect(spyOnLoggerDebug).toHaveBeenCalledWith(
      'Fetch error',
      errorMatrixServer
    )
    expect(mockResponse.write).toHaveBeenCalledWith(
      JSON.stringify(matrixUnauthorizedError)
    )
    expect(mockRequest.token).toBeUndefined()
  })

  it('should send response with 401 unauthorized error if user is not authenticated on matrix server', async () => {
    const userInfo = { ...matrixServerResponseBody, user_id: null }
    jest.spyOn(db, 'get').mockResolvedValue([])
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockResolvedValue(userInfo)
    })
    const handler: expressAppHandler = isAuth(
      db as TwakeDB,
      conf as Config,
      logger
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(db.insert).not.toHaveBeenCalled()
    expect(spyOnLoggerWarn).toHaveBeenCalledWith('Bad token', userInfo)
    expect(mockResponse.write).toHaveBeenCalledWith(
      JSON.stringify(matrixUnauthorizedError)
    )
    expect(mockRequest.token).toBeUndefined()
  })

  it('should call console.error function if insert access_token in database failed', async () => {
    const errorDb = new Error('An error occured in the database')
    jest.spyOn(db, 'get').mockResolvedValue([])
    jest.spyOn(db, 'insert').mockRejectedValue(errorDb)
    const handler: expressAppHandler = isAuth(
      db as TwakeDB,
      conf as Config,
      logger
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(spyOnLoggerError).toHaveBeenCalledWith(
      'Unable to insert a token',
      errorDb
    )
    expect(mockRequest.token?.value).toEqual(token.value)
    expect(mockRequest.token?.content.sub).toEqual(
      matrixServerResponseBody.user_id
    )
  })
})
