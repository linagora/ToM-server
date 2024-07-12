import { type NextFunction, type Request, type Response } from 'express'
import { type TwakeDB } from '../../db'
import { type tokenDetail } from '../middlewares/auth'
import { VaultAPIError, type expressAppHandler } from '../utils'
import {
  getRecoveryWords,
  methodNotAllowed,
  saveRecoveryWords,
  updateRecoveryWords
} from './vault'

const words = 'This is a test sentence'

interface ITestRequest extends Partial<Request> {
  token: tokenDetail
}

describe('Vault controllers', () => {
  const dbManager: Partial<TwakeDB> = {
    get: jest.fn(),
    insert: jest.fn(),
    deleteWhere: jest.fn(),
    update: jest.fn()
  }
  let mockRequest: ITestRequest
  let mockResponse: Partial<Response>
  const nextFunction: NextFunction = jest.fn()

  beforeAll(() => {
    mockRequest = {
      token: {
        value: 'token_value',
        content: {
          sub: 'userId',
          epoch: 1
        }
      },
      body: {
        words
      }
    }

    mockResponse = {
      statusCode: undefined,
      status: jest.fn().mockImplementation((code: number) => {
        mockResponse.statusCode = code
        return mockResponse
      }),
      json: jest.fn().mockReturnValue(mockResponse),
      writeHead: jest.fn(),
      write: jest.fn(),
      send: jest.fn(),
      end: jest.fn()
    }
  })

  afterEach(() => {
    mockResponse.statusCode = undefined
  })

  afterEach(() => {
    jest.resetModules()
  })

  it('should throw method not allowed error', () => {
    expect(() => {
      methodNotAllowed(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      )
    }).toThrow(new VaultAPIError('Method not allowed', 405))
  })

  // Testing saveRecoveryWords
  it('should return response with status code 201 on save success', async () => {
    jest.spyOn(dbManager, 'insert').mockResolvedValue([{ words }])
    jest.spyOn(dbManager, 'get').mockResolvedValue([])
    const handler: expressAppHandler = saveRecoveryWords(dbManager as TwakeDB)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(201)
  })

  it('should call next function to throw error on saving failed', async () => {
    const errorMsg = 'Insert failed'
    jest.spyOn(dbManager, 'insert').mockRejectedValue(new Error(errorMsg))
    jest.spyOn(dbManager, 'get').mockResolvedValue([])
    const handler: expressAppHandler = saveRecoveryWords(dbManager as TwakeDB)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(new Error(errorMsg))
  })

  it('should return a 409 response when recovery words already exists', async () => {
    jest
      .spyOn(dbManager, 'get')
      .mockResolvedValue([{ words: 'Another sentence for the same user' }])
    const handler: expressAppHandler = saveRecoveryWords(dbManager as TwakeDB)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(409)
    expect(dbManager.insert).not.toHaveBeenCalled()
  })

  it('should return a 400 error if the body does not contain recovery words', async () => {
    jest.spyOn(dbManager, 'get').mockResolvedValue([])
    const handler: expressAppHandler = saveRecoveryWords(dbManager as TwakeDB)
    const emptyRequest = { ...mockRequest, body: {} }
    handler(emptyRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(400)
    expect(dbManager.insert).not.toHaveBeenCalled()
  })

  // Testing getRecoveryWords

  it('should return response with status code 200 on get success', async () => {
    jest.spyOn(dbManager, 'get').mockResolvedValue([{ words }])
    const handler: expressAppHandler = getRecoveryWords(dbManager as TwakeDB)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(200)
  })

  it('should call next function to throw not found error when no result', async () => {
    jest.spyOn(dbManager, 'get').mockResolvedValue([])
    const handler: expressAppHandler = getRecoveryWords(dbManager as TwakeDB)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(
      new VaultAPIError('User has no recovery sentence', 404)
    )
  })

  it('should call next function to throw conflict error when duplicate results', async () => {
    jest
      .spyOn(dbManager, 'get')
      .mockResolvedValue([
        { words },
        { words: 'Another sentence for the same user' }
      ])
    const handler: expressAppHandler = getRecoveryWords(dbManager as TwakeDB)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(
      new VaultAPIError('User has more than one recovery sentence', 409)
    )
  })

  it('should call next function to throw not found error on getting failed', async () => {
    const errorMsg = 'Get failed'
    jest.spyOn(dbManager, 'get').mockRejectedValue(new Error(errorMsg))
    const handler: expressAppHandler = getRecoveryWords(dbManager as TwakeDB)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(new Error(errorMsg))
  })

  it('should return a 200 response on update success', async () => {
    jest
      .spyOn(dbManager, 'get')
      .mockResolvedValue([{ userId: 'test', words: 'some recovery words' }])
    const handler: expressAppHandler = updateRecoveryWords(dbManager as TwakeDB)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(200)
  })

  it('should throw a 404 error when no recovery words were found', async () => {
    jest.spyOn(dbManager, 'get').mockResolvedValue([])
    const handler: expressAppHandler = updateRecoveryWords(dbManager as TwakeDB)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(404)
  })

  it('should throw a 400 error when the body does not contain recovery words', async () => {
    jest.spyOn(dbManager, 'get').mockResolvedValue([{ userId: 'test' }])
    const handler: expressAppHandler = updateRecoveryWords(dbManager as TwakeDB)
    const emptyRequest = { ...mockRequest, body: {} }
    handler(emptyRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(400)
  })
})
