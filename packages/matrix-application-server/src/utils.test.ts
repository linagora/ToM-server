import { type Request, type Response, type NextFunction } from 'express'
import { allowCors } from './utils'

describe('Utils methods', () => {
  let mockRequest: Partial<Request>
  const mockResponse: Partial<Response> = {
    setHeader: jest.fn().mockImplementation(() => {
      return mockResponse
    })
  }
  const nextFunction: NextFunction = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockRequest = {}
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

})
