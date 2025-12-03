import { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import { IdentityServerDb, type MatrixDB } from '@twake/matrix-identity-server'
import {
  type Application,
  type NextFunction,
  type Request,
  type Response
} from 'express'
import fs from 'fs'
import fetch from 'node-fetch'
import path from 'path'
import JEST_PROCESS_ROOT_PATH from '../../../jest.globals'
import IdServer from '../../identity-server'
import { type Config } from '../../types'
import { type expressAppHandler } from '../utils'
import isAuth, { type tokenDetail } from './auth'

interface ITestRequest extends Partial<Request> {
  token?: tokenDetail
}

const mockLogger: Partial<TwakeLogger> = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  close: jest.fn()
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

const mockRequestDefaultProperties: Partial<Request> = {
  app: { get: jest.fn().mockReturnValue(false) } as unknown as Application,
  ip: '192.168.1.1'
}

jest
  .spyOn(IdentityServerDb.prototype, 'get')
  .mockResolvedValue([{ id: token.value, data: JSON.stringify(token.content) }])

jest
  .spyOn(IdentityServerDb.prototype, 'insert')
  .mockResolvedValue([{ id: token.value, data: JSON.stringify(token.content) }])

const idServer = new IdServer(
  {
    get: jest.fn()
  } as unknown as MatrixDB,
  {} as unknown as Config,
  {
    database_engine: 'sqlite',
    database_host: 'test.db',
    rate_limiting_window: 10000,
    rate_limiting_nb_requests: 100,
    template_dir: './templates',
    userdb_host: './tokens.db',
    matrix_server: 'localhost',
    features: {
      common_settings: { enabled: false },
      user_profile: {
        default_visibility_settings: {
          visibility: 'private',
          visible_fields: []
        }
      },
      user_directory: { enabled: true }
    }
  } as unknown as ConfigDescription,
  mockLogger as TwakeLogger
)

describe('Auth middleware', () => {
  let spyOnLoggerWarn: jest.SpyInstance
  let spyOnLoggerDebug: jest.SpyInstance
  let spyOnLoggerError: jest.SpyInstance
  let mockRequest: ITestRequest
  let mockResponse: Partial<Response>
  const nextFunction: NextFunction = jest.fn()
  beforeAll((done) => {
    idServer.ready
      .then((_) => {
        mockResponse = {
          writeHead: jest.fn(),
          write: jest.fn(),
          send: jest.fn(),
          end: jest.fn()
        }
        spyOnLoggerWarn = jest.spyOn(idServer.logger, 'warn')
        spyOnLoggerDebug = jest.spyOn(idServer.logger, 'debug')
        spyOnLoggerError = jest.spyOn(idServer.logger, 'error')
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  beforeEach(() => {
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockResolvedValue(matrixServerResponseBody)
    })
    mockRequest = {
      ...mockRequestDefaultProperties,
      headers: {
        authorization: `Bearer ${token.value}`
      }
    }
    mockRequest.token = undefined
    jest.clearAllMocks()
  })

  afterAll(() => {
    idServer.cleanJobs()
    const pathFilesToDelete = [
      path.join(JEST_PROCESS_ROOT_PATH, 'test.db'),
      path.join(JEST_PROCESS_ROOT_PATH, 'tokens.db')
    ]
    pathFilesToDelete.forEach((path) => {
      if (fs.existsSync(path)) fs.unlinkSync(path)
    })
  })

  it('should retrieve token from authorization header and store token data in req object', async () => {
    const handler: expressAppHandler = isAuth(idServer.authenticate)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockRequest.token).toStrictEqual(token)
  })

  it('should retrieve token from query parameters and store token data in req object', async () => {
    mockRequest = {
      ...mockRequestDefaultProperties,
      headers: {},
      query: {
        access_token: token.value
      }
    }
    const handler: expressAppHandler = isAuth(idServer.authenticate)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockRequest.token).toStrictEqual(token)
  })

  it('should add access_token in database if no entry found and user is already authenticated on matrix server', async () => {
    jest.spyOn(idServer.db, 'get').mockResolvedValue([])
    const handler: expressAppHandler = isAuth(idServer.authenticate)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(idServer.db.insert).toHaveBeenCalled()
    expect(mockRequest.token?.value).toEqual(token.value)
    expect(mockRequest.token?.content.sub).toEqual(
      matrixServerResponseBody.user_id
    )
  })

  it('should retrieve token from matrix server if an error occured on retrieving associated entry in database', async () => {
    const errorDb = new Error('An error occured in the database')
    jest.spyOn(idServer.db, 'get').mockRejectedValue(errorDb)
    const handler: expressAppHandler = isAuth(idServer.authenticate)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(idServer.db.insert).toHaveBeenCalled()
    expect(mockRequest.token?.value).toEqual(token.value)
    expect(mockRequest.token?.content.sub).toEqual(
      matrixServerResponseBody.user_id
    )
  })

  it('should send response with 401 unauthorized error if authorization header value does not match regex', async () => {
    mockRequest = {
      ...mockRequestDefaultProperties,
      headers: {
        authorization: 'falsy_token'
      },
      query: {}
    }
    const handler: expressAppHandler = isAuth(idServer.authenticate)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
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
      ...mockRequestDefaultProperties,
      headers: {},
      query: {
        access_token: undefined
      }
    }
    const handler: expressAppHandler = isAuth(idServer.authenticate)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
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
      ...mockRequestDefaultProperties,
      headers: {},
      query: {}
    }
    const handler: expressAppHandler = isAuth(idServer.authenticate)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(spyOnLoggerWarn).toHaveBeenCalledWith(
      'Access tried without token',
      {}
    )
    expect(mockResponse.write).toHaveBeenCalledWith(
      JSON.stringify(matrixUnauthorizedError)
    )
    expect(mockRequest.token).toBeUndefined()
  })

  it('should send response with 401 unauthorized error if query field is undefined', async () => {
    mockRequest = {
      ...mockRequestDefaultProperties,
      headers: {},
      query: undefined
    }
    const handler: expressAppHandler = isAuth(idServer.authenticate)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.write).toHaveBeenCalledWith(
      JSON.stringify(matrixUnauthorizedError)
    )
    expect(mockRequest.token).toBeUndefined()
  })

  it('should send response with 401 unauthorized error if request to Matrix server failed', async () => {
    const errorMatrixServer = new Error('An error occured with Matrix Server')
    jest.spyOn(idServer.db, 'get').mockResolvedValue([])
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockRejectedValue(errorMatrixServer)
    })
    const handler: expressAppHandler = isAuth(idServer.authenticate)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(idServer.db.insert).not.toHaveBeenCalled()
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
    jest.spyOn(idServer.db, 'get').mockResolvedValue([])
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockResolvedValue(userInfo)
    })
    const handler: expressAppHandler = isAuth(idServer.authenticate)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(idServer.db.insert).not.toHaveBeenCalled()
    expect(mockResponse.write).toHaveBeenCalledWith(
      JSON.stringify(matrixUnauthorizedError)
    )
    expect(mockRequest.token).toBeUndefined()
  })

  it('should call console.error function if insert access_token in database failed', async () => {
    const errorDb = new Error('An error occured in the database')
    jest.spyOn(idServer.db, 'get').mockResolvedValue([])
    jest.spyOn(idServer.db, 'insert').mockRejectedValue(errorDb)
    const handler: expressAppHandler = isAuth(idServer.authenticate)
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
