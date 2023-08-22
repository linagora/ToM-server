import { type NextFunction, type Request, type Response } from 'express'
import { AppServerAPIError, errCodes } from './errors'
import { allowCors, legacyEndpointHandler, methodNotAllowed } from './utils'

describe('Utils methods', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let nextFunction: NextFunction

  beforeEach(() => {
    mockResponse = {
      setHeader: jest.fn().mockImplementation(() => {
        return mockResponse
      }),
      status: jest.fn().mockImplementation(() => {
        return mockResponse
      }),
      json: jest.fn().mockImplementation(() => {
        return mockResponse
      }),
      location: jest.fn().mockImplementation(() => {
        return mockResponse
      })
    }
    nextFunction = jest.fn()
    mockRequest = {}
  })

  it('methodNotAllowed: should throw an error with 405 status', () => {
    expect(() => {
      methodNotAllowed(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      )
    }).toThrow(
      new AppServerAPIError({ status: 405, code: errCodes.unrecognized })
    )
  })

  it('allowCors: should set header in response to avoid CORS error', async () => {
    allowCors(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(mockResponse.setHeader).toHaveBeenCalledTimes(3)
    expect(mockResponse.setHeader).toHaveBeenNthCalledWith(
      1,
      'Access-Control-Allow-Origin',
      '*'
    )
    expect(mockResponse.setHeader).toHaveBeenNthCalledWith(
      2,
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    )
    expect(mockResponse.setHeader).toHaveBeenNthCalledWith(
      3,
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    )
  })

  it('legacyEndpointHandler: should set Location header with the real endpoint path', async () => {
    mockRequest = {
      ...mockRequest,
      originalUrl: '/old-endpoint'
    }
    legacyEndpointHandler(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )
    expect(mockResponse.status).toHaveBeenCalledTimes(1)
    expect(mockResponse.status).toHaveBeenCalledWith(308)
    expect(mockResponse.location).toHaveBeenCalledTimes(1)
    expect(mockResponse.location).toHaveBeenCalledWith(
      `/_matrix/app/v1${mockRequest.originalUrl as string}`
    )
    expect(mockResponse.json).toHaveBeenCalledTimes(1)
    expect(mockResponse.json).toHaveBeenCalledWith({
      errcode: errCodes.unknown,
      error: 'This non-standard endpoint has been removed'
    })
  })
})
