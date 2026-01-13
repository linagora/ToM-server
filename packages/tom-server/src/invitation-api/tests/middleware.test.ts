import type { AuthRequest, Config, TwakeDB } from '../../types'
import type { Response, NextFunction } from 'express'
import Middleware from '../middlewares'
import { type TwakeLogger } from '@twake-chat/logger'
import type { Invitation } from '../types'

let mockRequest: Partial<AuthRequest>
let mockResponse: Partial<Response>

const EXPIRATION = 24 * 60 * 60 * 1000 // 24 hours
const TEST_DELAY = 1000 * 60 // 1 minute

const dbMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}

const nextFunction: NextFunction = jest.fn()
const middleware = new Middleware(
  dbMock as unknown as TwakeDB,
  loggerMock as unknown as TwakeLogger,
  {} as unknown as Config
)

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

describe('the Invitation API middleware', () => {
  describe('the checkInvitationPayload method', () => {
    it('should not call the next handler if the invitation payload is invalid', async () => {
      middleware.checkInvitationPayload(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should call the next handler if the invitation payload is valid', async () => {
      mockRequest.body = {
        contact: '+21652123456',
        medium: 'phone'
      }

      middleware.checkInvitationPayload(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )
    })

    it('should not call the next handler if the medium does not match the contact', async () => {
      mockRequest.body = {
        contact: '+21652123456',
        medium: 'email'
      }

      middleware.checkInvitationPayload(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should not call the next handler if the contact is invalid', async () => {
      mockRequest.body = {
        contact: 'test',
        medium: 'phone'
      }

      middleware.checkInvitationPayload(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should not call the next handler if the medium is not valid', async () => {
      mockRequest.body = {
        contact: '+21652123456',
        medium: 'test'
      }

      middleware.checkInvitationPayload(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })
  })

  describe('the checkInvitation method', () => {
    it('should not call the next handler if the invitation does not exist', async () => {
      dbMock.get.mockResolvedValue([])

      await middleware.checkInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should call the next handler if the invitation exists', async () => {
      dbMock.get.mockResolvedValue([
        {
          contact: '+21652123456',
          medium: 'phone',
          expiration: Date.now() + TEST_DELAY
        }
      ])

      mockRequest.params = { id: 'test' }

      await middleware.checkInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should not call the next handler if the invitation is expired', async () => {
      dbMock.get.mockResolvedValue([
        {
          contact: '+21652123456',
          medium: 'phone',
          expiration: Date.now() - TEST_DELAY
        }
      ])

      await middleware.checkInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should not call the next handler if the invitation id is not provided', async () => {
      mockRequest.params = {}

      await middleware.checkInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should return 404 if the invitation does not exist', async () => {
      dbMock.get.mockResolvedValue([])

      mockRequest.params = { id: 'test' }

      await middleware.checkInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(404)
    })

    it('should return 400 if the invitation is expired', async () => {
      dbMock.get.mockResolvedValue([
        {
          contact: '+21652123456',
          medium: 'phone',
          expiration: Date.now() - TEST_DELAY
        }
      ])

      await middleware.checkInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if something wrong happens while checkinf the invitation', async () => {
      dbMock.get.mockRejectedValue(new Error('Something wrong happened'))

      await middleware.checkInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })

  describe('the rateLimitInvitations method', () => {
    it('should not let the user to send another invitation to the same contact within 24 hours', async () => {
      dbMock.get.mockResolvedValue([
        {
          contact: '+21652123456',
          medium: 'phone',
          expiration: Date.now() + EXPIRATION
        }
      ])

      mockRequest.body = {
        contact: '+21652123456',
        medium: 'phone'
      }

      await middleware.rateLimitInvitations(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should call the next handler if the user has not sent an invitation to the same contact', async () => {
      dbMock.get.mockResolvedValue([])

      mockRequest.body = {
        contact: '+21652123456',
        medium: 'phone'
      }

      await middleware.rateLimitInvitations(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should call the next handler if the user has sent an invitation to the same contact more than 24 hours ago', async () => {
      dbMock.get.mockResolvedValue([
        {
          contact: '+21652123456',
          medium: 'phone',
          expiration: Date.now() - EXPIRATION + TEST_DELAY
        }
      ])

      mockRequest.body = {
        contact: '+21652123456',
        medium: 'phone'
      }

      await middleware.rateLimitInvitations(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should return 400 if the user has already sent an invitation to the same contact', async () => {
      dbMock.get.mockResolvedValue([
        {
          contact: '+21652123456',
          medium: 'phone',
          expiration: Date.now() + EXPIRATION
        }
      ])

      mockRequest.body = {
        contact: '+21652123456',
        medium: 'phone'
      }

      await middleware.rateLimitInvitations(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if something wrong happens while rate limiting the invitations', async () => {
      dbMock.get.mockRejectedValue(new Error('Something wrong happened'))

      await middleware.rateLimitInvitations(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })

  describe('the checkInvitationOwnership', () => {
    it('should not call the next handler if the invitation is not owned by the user', async () => {
      dbMock.get.mockResolvedValue([
        {
          recipient: '000000000000',
          medium: 'phone',
          expiration: `${Date.now() + EXPIRATION}`,
          sender: 'test2',
          accessed: false,
          id: 'test'
        } satisfies Invitation
      ])

      await middleware.checkInvitationOwnership(
        { ...mockRequest, params: { id: 'test' } } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should call the next handler if the invitation is owned by the user', async () => {
      dbMock.get.mockResolvedValue([
        {
          recipient: '000000000000',
          medium: 'phone',
          expiration: `${Date.now() + EXPIRATION}`,
          sender: 'test',
          accessed: false,
          id: 'test'
        } satisfies Invitation
      ])

      await middleware.checkInvitationOwnership(
        { ...mockRequest, params: { id: 'test' } } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should return 403 if the invitation is not owned by the user', async () => {
      dbMock.get.mockResolvedValue([
        {
          contact: '000000000000',
          medium: 'phone',
          expiration: `${Date.now() + EXPIRATION}`,
          sender: 'test2'
        }
      ])

      await middleware.checkInvitationOwnership(
        { ...mockRequest, params: { id: 'test' } } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(403)
    })

    it('should return 404 if the invitation is not found', async () => {
      dbMock.get.mockResolvedValue([])

      await middleware.checkInvitationOwnership(
        { ...mockRequest, params: { id: 'test' } } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(404)
    })
  })
  describe('the checkGenerateInvitationLinkPayload method', () => {
    it('should call the next handler if the body is empty', async () => {
      await middleware.checkGenerateInvitationLinkPayload(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should not call the next handler if there body contains invalid data', async () => {
      await middleware.checkGenerateInvitationLinkPayload(
        { ...mockRequest, body: { medium: 'test' } } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should call the checkInvitationPayload middleware body contains enough data', async () => {
      middleware.checkInvitationPayload = jest.fn()

      await middleware.checkGenerateInvitationLinkPayload(
        {
          ...mockRequest,
          body: {
            medium: 'phone',
            contact: '000000000000'
          }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(middleware.checkInvitationPayload).toHaveBeenCalled()
      jest.resetAllMocks()
    })
  })
  describe('the checkFeatureEnabled method', () => {
    it('should not call the next handler if the invitations are disabled', async () => {
      await middleware.checkFeatureEnabled(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should call the next handler if the invitations are enabled', async () => {
      const altMiddleware = new Middleware(
        dbMock as unknown as TwakeDB,
        loggerMock as unknown as TwakeLogger,
        {
          twake_chat: {
            enable_invitations: true
          }
        } as unknown as Config
      )

      await altMiddleware.checkFeatureEnabled(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })
  })
})
