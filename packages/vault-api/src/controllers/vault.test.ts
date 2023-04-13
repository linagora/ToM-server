import VaultDb from '../db'
import fs from 'fs'
import { getRecoveryWords, methodNotAllowed, saveRecoveryWords } from './vault'
import DefaultConfig from '../config.json'
import { type Request, type Response, type NextFunction } from 'express'
import { type expressAppHandler, type Config } from '../utils'
import { type tokenDetail } from '../middlewares/auth'

const testFilePath = './testcontrollers.db'

const baseConf: Config = {
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
    dbManager = new VaultDb(baseConf)
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
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
    jest.resetModules()
  })

  it('should return response with status code 405 on method not allowed', () => {
    methodNotAllowed(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )
    expect(mockResponse.statusCode).toEqual(405)
  })

  it('should return response with status code 201 on save success', async () => {
    jest.spyOn(dbManager, 'insert').mockResolvedValue()
    const handler: expressAppHandler = saveRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(201)
  })

  it('should return response with status code 500 on save error', async () => {
    jest
      .spyOn(dbManager, 'insert')
      .mockRejectedValue(new Error('Insert failed'))
    const handler: expressAppHandler = saveRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(500)
  })

  it('should return response with status code 200 on get success', async () => {
    jest.spyOn(dbManager, 'get').mockResolvedValue([{ words }])
    const handler: expressAppHandler = getRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(200)
  })

  it('should return response with status code 404 when no result', async () => {
    jest.spyOn(dbManager, 'get').mockResolvedValue([])
    const handler: expressAppHandler = getRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(404)
  })

  it('should return response with status code 409 when duplicate results', async () => {
    jest
      .spyOn(dbManager, 'get')
      .mockResolvedValue([
        { words },
        { words: 'Another sentence for the same user' }
      ])
    const handler: expressAppHandler = getRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(409)
  })

  it('should return response with status code 500 on get error', async () => {
    jest.spyOn(dbManager, 'get').mockRejectedValue(new Error('Get failed'))
    const handler: expressAppHandler = getRecoveryWords(dbManager)
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    await new Promise(process.nextTick)
    expect(mockResponse.statusCode).toEqual(500)
  })
})
