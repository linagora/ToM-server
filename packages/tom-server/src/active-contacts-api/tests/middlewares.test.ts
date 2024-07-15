import type { AuthRequest } from '../../types'
import type { Response, NextFunction } from 'express'
import ActiveContactsMiddleware from '../middlewares'

describe('The active contacts API middleware', () => {
  let mockRequest: Partial<AuthRequest>
  let mockResponse: Partial<Response>
  const nextFunction: NextFunction = jest.fn()

  const activeContactsMiddleware = new ActiveContactsMiddleware()

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      userId: 'test'
    }
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    }
  })

  describe('the checkCreationRequirements middleware', () => {
    it('should return a 400 error if data is missing', async () => {
      mockRequest.body = {}

      activeContactsMiddleware.checkCreationRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Bad Request'
      })
    })

    it('should call the next handler if the requirements are met', async () => {
      mockRequest.body = { contacts: 'test' }

      activeContactsMiddleware.checkCreationRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalledWith()
    })
  })
})
