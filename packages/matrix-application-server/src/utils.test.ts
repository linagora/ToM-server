import { type Request, type Response, type NextFunction } from 'express'
import { allowCors, legacyEndpointHandler, methodNotAllowed } from './utils'
import { AppServerAPIError, ErrCodes } from './errors'

describe('Utils methods', () => {
  let mockRequest: Partial<Request>
  const mockResponse: Partial<Response> = {
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
  const nextFunction: NextFunction = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
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
      new AppServerAPIError({ status: 405, code: ErrCodes.M_UNRECOGNIZED })
    )
  })

  it('allowCors: should set header in response to avoid CORS error', async () => {
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
    expect(mockResponse.status).toHaveBeenCalledWith(308)
    expect(mockResponse.location).toHaveBeenCalledWith(
      `/_matrix/app/v1${mockRequest.originalUrl as string}`
    )
    expect(mockResponse.json).toHaveBeenCalledWith({
      errcode: ErrCodes.M_UNKNOWN,
      error: 'This non-standard endpoint has been removed'
    })
  })
})
