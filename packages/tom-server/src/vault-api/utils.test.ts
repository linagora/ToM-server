import { type Request, type Response, type NextFunction } from 'express'
import { VaultAPIError, allowCors, errorMiddleware } from './utils'

describe('Utils methods', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let nextFunction: NextFunction

  beforeEach(() => {
    nextFunction = jest.fn()
    mockResponse = {
      setHeader: jest.fn(),
      status: jest.fn(),
      json: jest.fn()
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should set header in response to avoid CORS error', async () => {
    allowCors(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(mockResponse.setHeader).toHaveBeenCalledTimes(3)
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      '*'
    )
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    )
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    )
  })

  it('should send a response containing the common catched error message', async () => {
    const errorMsg = 'This is an error message'
    errorMiddleware(
      new Error(errorMsg),
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )
    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockResponse.json).toHaveBeenCalledWith({ error: errorMsg })
  })

  it('should send a response containing the vault API catched error message', async () => {
    const error = new VaultAPIError('This is a Vault API error message', 404)
    errorMiddleware(
      error,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )
    expect(mockResponse.status).toHaveBeenCalledWith(404)
    expect(mockResponse.json).toHaveBeenCalledWith({ error: error.message })
  })
})
