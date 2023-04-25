import { type Request, type Response, type NextFunction } from 'express'
import {
  AppServerAPIError,
  ErrCodes,
  defaultErrorMsg,
  errorMiddleware
} from './errors'

describe('Errors', () => {
  let mockRequest: Partial<Request>
  const mockResponse: Partial<Response> = {
    status: jest.fn(),
    json: jest.fn()
  }
  const nextFunction: NextFunction = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should send a response containing the custom catched error message', async () => {
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

  it('should send a response containing the matrix error message', async () => {
    const error = new AppServerAPIError({
      status: 404,
      code: ErrCodes.M_FORBIDDEN
    })
    errorMiddleware(
      error,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )
    expect(mockResponse.status).toHaveBeenCalledWith(404)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: error.message,
      errcode: error.errcode
    })
  })

  it('should send a response containing the default error message', async () => {
    const error = new AppServerAPIError()
    errorMiddleware(
      error,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )
    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: defaultErrorMsg
    })
  })
})
