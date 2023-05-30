import { AppServerAPIError } from '../utils'
import { type Request, type Response, type NextFunction } from 'express'
import { Result } from 'express-validator'
import { query } from './query'

describe('Query', () => {
  const mockRequest: Partial<Request> = {}
  let mockResponse: Partial<Response>
  let nextFunction: NextFunction

  beforeEach(() => {
    mockResponse = {
      send: jest.fn().mockImplementation(() => mockResponse)
    }
    nextFunction = jest.fn()
  })

  it('should send a response', () => {
    query(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(mockResponse.send).toHaveBeenCalledWith()
  })

  it('should throw an AppServerAPIError error status 400 if there are error with transaction id or request body events', () => {
    jest.spyOn(Result.prototype, 'isEmpty').mockImplementation(() => {
      return false
    })
    jest.spyOn(Result.prototype, 'array').mockImplementation(() => {
      return [
        {
          type: 'field',
          msg: 'blabla',
          location: 'query',
          value: 123
        },
        {
          type: 'field',
          msg: 'yay',
          location: 'query',
          value: 'qux'
        }
      ]
    })

    try {
      query(mockRequest as Request, mockResponse as Response, nextFunction)
    } catch (e) {
      expect(e).toEqual(
        new AppServerAPIError({
          status: 400,
          message: 'Error field: blabla, Error field: yay'
        })
      )
      expect(mockResponse.send).not.toHaveBeenCalled()
    }
  })
})
