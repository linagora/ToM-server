import { type Request, type Response, type NextFunction } from 'express'
import { allowCors } from './utils'

describe('Utils methods', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let nextFunction: NextFunction

  beforeEach(() => {
    nextFunction = jest.fn()
    mockResponse = {
      setHeader: jest.fn()
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should retrieve token from authorization header and store token data in req object', async () => {
    const setHeader: jest.SpyInstance = jest.spyOn(mockResponse, 'setHeader')
    allowCors(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(setHeader).toHaveBeenCalledTimes(3)
    expect(setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
    expect(setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    )
    expect(setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    )
  })
})
