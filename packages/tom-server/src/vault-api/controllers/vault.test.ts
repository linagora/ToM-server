import VaultDb from '../db'
import fs from 'fs'
import { getRecoveryWords, methodNotAllowed, saveRecoveryWords } from './vault'
import DefaultConfig from '../config.json'
import { type Request, type Response, type NextFunction } from 'express'
import { type expressAppHandler, VaultAPIError } from '../utils'
import { type tokenDetail } from '../middlewares/auth'
import { type Config } from '../../utils'

const testFilePath = './testcontrollers.db'

const baseConf: Partial<Config> = {
  ...DefaultConfig,
  database_engine: 'sqlite',
  database_host: testFilePath
}

const words = 'This is a test sentence'

interface ITestRequest extends Partial<Request> {
  token: tokenDetail
}

describe('Vault controllers', () => {
  let dbManager: VaultDb
  let mockRequest: ITestRequest
  let mockResponse: Partial<Response>
  const nextFunction: NextFunction = jest.fn()

  beforeAll((done) => {
    dbManager = new VaultDb(baseConf as Config)
    dbManager.ready
      .then(() => {
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
          json: jest.fn().mockReturnValue(mockResponse)
        }
        done()
      })
      .catch((e) => done(e))
  })

  afterEach(() => {
    mockResponse.statusCode = undefined
  })

  afterEach(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
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

  it('should return response with status code 201 on save success', async () => {
    jest.spyOn(dbManager, 'insert').mockResolvedValue()
    const handler: expressAppHandler = saveRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(201)
  })

  it('should call next function to throw error on saving failed', async () => {
    const errorMsg = 'Insert failed'
    jest.spyOn(dbManager, 'insert').mockRejectedValue(new Error(errorMsg))
    const handler: expressAppHandler = saveRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(new Error(errorMsg))
  })

  it('should return response with status code 200 on get success', async () => {
    jest.spyOn(dbManager, 'get').mockResolvedValue([{ words }])
    const handler: expressAppHandler = getRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(200)
  })

  it('should call next function to throw not found error when no result', async () => {
    jest.spyOn(dbManager, 'get').mockResolvedValue([])
    const handler: expressAppHandler = getRecoveryWords(dbManager)
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
    const handler: expressAppHandler = getRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(
      new VaultAPIError('User has more than one recovery sentence', 409)
    )
  })

  it('should call next function to throw not found error on getting failed', async () => {
    const errorMsg = 'Get failed'
    jest.spyOn(dbManager, 'get').mockRejectedValue(new Error(errorMsg))
    const handler: expressAppHandler = getRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(nextFunction).toHaveBeenCalledWith(new Error(errorMsg))
  })
})
