import SmsApiMiddleware from '../middlewares/index.ts'
import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../types.ts'
import { getLogger } from '@twake-chat/logger'

describe('the SMS API middleware', () => {
  let mockRequest: Partial<AuthRequest>
  let mockResponse: Partial<Response>
  const nextFunction: NextFunction = jest.fn()
  const logger = getLogger()

  const smsApiMiddlewareMock = new SmsApiMiddleware(logger)

  beforeEach(() => {
    mockRequest = {}
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }
  })

  describe('checkSendRequirements middleware', () => {
    it('should call the next handler if the requirements are met', () => {
      mockRequest = {
        body: {
          to: '0000000000000',
          text: 'test'
        }
      }

      smsApiMiddlewareMock.checkSendRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should return 400 if the requirements are not met', () => {
      mockRequest = {
        body: {
          text: ''
        }
      }

      smsApiMiddlewareMock.checkSendRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Bad Request'
      })
      expect(nextFunction).not.toHaveBeenCalled()
    })
  })

  describe('validateMobilePhone middleware', () => {
    it('should call the next handler if the phone number is valid', () => {
      mockRequest = {
        body: {
          to: '+21652127155'
        }
      }

      smsApiMiddlewareMock.validateMobilePhone(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should return 400 if the phone number is invalid', () => {
      mockRequest = {
        body: {
          to: 'invalid'
        }
      }

      smsApiMiddlewareMock.validateMobilePhone(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Invalid phone number'
      })
      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should return 400 if one of the phone number list is invalid', () => {
      mockRequest = {
        body: {
          to: ['+21652127155', '+21622547856', 'something else']
        }
      }

      smsApiMiddlewareMock.validateMobilePhone(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Invalid phone number'
      })
      expect(nextFunction).not.toHaveBeenCalled()
    })
  })
})
