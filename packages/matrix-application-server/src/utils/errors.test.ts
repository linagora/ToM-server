import { type NextFunction, type Request, type Response } from 'express'
import {
  AppServerAPIError,
  defaultErrorMsg,
  errCodes,
  errorMiddleware
} from './errors'

describe('Errors', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let nextFunction: NextFunction

  beforeEach(() => {
    mockResponse = {
      status: jest.fn(),
      json: jest.fn()
    }
    nextFunction = jest.fn()
  })

  it('should send a response containing the custom catched error message', async () => {
    const errorMsg = 'This is an error message'
    errorMiddleware(
      new Error(errorMsg),
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )
    expect(mockResponse.status).toHaveBeenCalledTimes(1)
    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockResponse.json).toHaveBeenCalledTimes(1)
    expect(mockResponse.json).toHaveBeenCalledWith({ error: errorMsg })
  })

  it('should send a response containing the matrix error message', async () => {
    const error = new AppServerAPIError({
      status: 404,
      code: errCodes.forbidden
    })
    errorMiddleware(
      error,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )
    expect(mockResponse.status).toHaveBeenCalledTimes(1)
    expect(mockResponse.status).toHaveBeenCalledWith(404)
    expect(mockResponse.json).toHaveBeenCalledTimes(1)
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
    expect(mockResponse.status).toHaveBeenCalledTimes(1)
    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockResponse.json).toHaveBeenCalledTimes(1)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: defaultErrorMsg
    })
  })
})
