import errorMiddleware from './error.middleware'
import { type Request, type Response, type NextFunction } from 'express'

describe('Error middleware', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  const nextFunction: NextFunction = jest.fn()

  beforeEach(() => {
    mockRequest = {}
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    }

    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should return the specified error message', () => {
    const expectedErrorResponse = {
      message: 'Error message'
    }

    errorMiddleware(
      { message: 'Error message', name: 'some error', status: 123 },
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    expect(mockResponse.json).toHaveBeenCalledWith(expectedErrorResponse)
  })

  it('should default to a 500 generic error when no error is specified', () => {
    const expectedErrorResponse = {
      message: 'Something went wrong'
    }

    errorMiddleware(
      { name: 'idk' } as unknown as Error,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockResponse.json).toHaveBeenCalledWith(expectedErrorResponse)
  })

  it('should call the next handler when something wrong happens', () => {
    mockResponse.status = () => {
      throw Error('something unexpected')
    }

    errorMiddleware(
      { name: 'idk' } as unknown as Error,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    expect(nextFunction).toHaveBeenCalled()
  })
})
