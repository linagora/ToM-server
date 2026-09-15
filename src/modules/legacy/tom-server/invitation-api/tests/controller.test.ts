import { beforeEach, describe, expect, it, mock, test } from "bun:test"
import type { TwakeLogger } from '../../../logger'
import type { MatrixDB, UserDB } from '../../../../matrix-identity-server'
import type { Response, NextFunction } from 'express'
import InvitationApiController from '../controllers'
import type { AuthRequest, Config, TwakeDB } from '../../types'
import type {
  InvitationRequestPayload,
  GenerateInvitationLinkRequestPayload,
  IInvitationService,
  InvitationResponse
} from '../types'

type Mocked<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? Mock<T[K]> : T[K] }

const mockInvitationService: Mocked<IInvitationService> = {
  invite: mock(),
  accept: mock(),
  list: mock(),
  generateLink: mock(),
  getInvitationStatus: mock(),
  removeInvitation: mock()
}

mock.module('../services', () => {
  return { default: mock().mockImplementation(() => mockInvitationService) }
})

mock.module('../../user-info-api/services', () => {
  return { default: mock().mockImplementation(() => ({
    get: mock().mockResolvedValue({ display_name: 'Test User' }),
    getVisibility: mock(),
    updateVisibility: mock()
  })) }
})

mock.module('../../utils/services/notification-service', () => {
  return { default: mock().mockImplementation(() => ({
    sendEmail: mock(),
    sendSMS: mock(),
    emailFrom: 'noreply@example.com'
  })) }
})

describe('InvitationApiController', () => {
  let controller: InvitationApiController
  let mockRequest: Partial<AuthRequest>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction
  let statusSpy: Mock<(...args: any[]) => any>
  let jsonSpy: Mock<(...args: any[]) => any>

  const dbMock = {
    get: mock(),
    insert: mock(),
    update: mock(),
    deleteEqual: mock()
  } as unknown as TwakeDB

  const userDbMock = {} as unknown as UserDB
  const matrixDbMock = {} as unknown as MatrixDB

  const loggerMock = {
    info: mock(),
    error: mock(),
    debug: mock(),
    warn: mock()
  } as unknown as TwakeLogger

  const configMock = {
    matrix_server: 'https://matrix.example.com',
    signup_url: 'https://signup.example.com'
  } as unknown as Config

  beforeEach(() => {
    mock.clearAllMocks()

    controller = new InvitationApiController(
      dbMock,
      userDbMock,
      matrixDbMock,
      loggerMock,
      configMock
    )

    statusSpy = mock().mockReturnThis()
    jsonSpy = mock().mockReturnThis()

    mockResponse = {
      status: statusSpy,
      json: jsonSpy
    }
    mockNext = mock()
  })

  describe('sendInvitation', () => {
    const validPayload: InvitationRequestPayload = {
      contact: 'recipient@example.com',
      medium: 'email'
    }

    beforeEach(() => {
      mockRequest = {
        body: validPayload,
        userId: '@sender:example.com',
        headers: { authorization: 'Bearer test-token' }
      }
    })

    it('should return 200 with invitation id when successful', async () => {
      mockInvitationService.invite.mockResolvedValue('invitation-id-123')

      await controller.sendInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Invitation sent',
        id: 'invitation-id-123'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should return 400 when sender is missing', async () => {
      mockRequest.userId = undefined

      await controller.sendInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(400)
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Sender is required'
      })
    })

    it('should return 400 when authorization header is missing', async () => {
      mockRequest.headers = {}

      await controller.sendInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(400)
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Authorization header is required'
      })
    })

    it('should delegate error handling to error middleware', async () => {
      const error = new Error('Service error')
      mockInvitationService.invite.mockRejectedValue(error)

      await controller.sendInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith(error)
      expect(statusSpy).not.toHaveBeenCalled()
    })

    it('should handle email with special characters', async () => {
      mockRequest.body = {
        contact: 'user+tag@example.com',
        medium: 'email'
      }
      mockInvitationService.invite.mockResolvedValue('invitation-id-123')

      await controller.sendInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'invitation-id-123'
        })
      )
    })

    it('should handle phone number contacts', async () => {
      mockRequest.body = {
        contact: '+33612345678',
        medium: 'phone'
      }
      mockInvitationService.invite.mockResolvedValue('invitation-id-456')

      await controller.sendInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'invitation-id-456'
        })
      )
    })
  })

  describe('acceptInvitation', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: 'invitation-123' },
        userId: '@user:example.com',
        headers: { authorization: 'Bearer test-token' }
      }
    })

    it('should return 200 with success message when accepted', async () => {
      mockInvitationService.accept.mockResolvedValue(undefined)

      await controller.acceptInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Invitation accepted'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should return 400 when invitation id is empty', async () => {
      mockRequest.params = { id: '' }

      await controller.acceptInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(400)
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Invitation id is required'
      })
    })

    it('should return 400 when authorization header is missing', async () => {
      mockRequest.headers = {}

      await controller.acceptInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(400)
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Authorization header is required'
      })
    })

    it('should return 400 when userId is missing', async () => {
      mockRequest.userId = undefined

      await controller.acceptInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(400)
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'User id is required'
      })
    })

    it('should delegate error handling to error middleware', async () => {
      const error = new Error('Service error')
      mockInvitationService.accept.mockRejectedValue(error)

      await controller.acceptInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith(error)
      expect(statusSpy).not.toHaveBeenCalled()
    })
  })

  describe('listInvitations', () => {
    beforeEach(() => {
      mockRequest = {
        userId: '@user:example.com'
      }
    })

    it('should return 200 with invitations list', async () => {
      const mockInvitations: InvitationResponse[] = [
        {
          id: 'invite-1',
          sender: '@user:example.com',
          recipient: 'test@example.com',
          medium: 'email',
          expiration: Date.now() + 86400000,
          accessed: false
        }
      ]
      mockInvitationService.list.mockResolvedValue(mockInvitations)

      await controller.listInvitations(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith({
        invitations: mockInvitations
      })
    })

    it('should return 400 when userId is missing', async () => {
      mockRequest.userId = undefined

      await controller.listInvitations(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(400)
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'User id is required'
      })
    })

    it('should return empty array when no invitations exist', async () => {
      mockInvitationService.list.mockResolvedValue([])

      await controller.listInvitations(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith({
        invitations: []
      })
    })

    it('should delegate error handling to error middleware', async () => {
      const error = new Error('Service error')
      mockInvitationService.list.mockRejectedValue(error)

      await controller.listInvitations(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith(error)
      expect(statusSpy).not.toHaveBeenCalled()
    })
  })

  describe('generateInvitationLink', () => {
    beforeEach(() => {
      mockRequest = {
        body: {
          contact: 'test@example.com',
          medium: 'email'
        } as GenerateInvitationLinkRequestPayload,
        userId: '@user:example.com'
      }
    })

    it('should return 200 with link and id', async () => {
      mockInvitationService.generateLink.mockResolvedValue({
        link: 'https://signup.example.com/?invitation_token=abc123',
        id: 'invite-123'
      })

      await controller.generateInvitationLink(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith({
        link: 'https://signup.example.com/?invitation_token=abc123',
        id: 'invite-123'
      })
    })

    it('should support generic link without contact and medium', async () => {
      mockRequest.body = {}
      mockInvitationService.generateLink.mockResolvedValue({
        link: 'https://signup.example.com/?invitation_token=xyz789',
        id: 'invite-456'
      })

      await controller.generateInvitationLink(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          link: expect.stringContaining('invitation_token=')
        })
      )
    })

    it('should support link generation with phone number', async () => {
      mockRequest.body = {
        contact: '+33612345678',
        medium: 'phone'
      }
      mockInvitationService.generateLink.mockResolvedValue({
        link: 'https://signup.example.com/?invitation_token=def456',
        id: 'invite-789'
      })

      await controller.generateInvitationLink(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'invite-789'
        })
      )
    })

    it('should delegate error handling when sender is missing', async () => {
      mockRequest.userId = undefined

      await controller.generateInvitationLink(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Sender is required'
        })
      )
      expect(statusSpy).not.toHaveBeenCalled()
    })

    it('should delegate error handling to error middleware', async () => {
      const error = new Error('Service error')
      mockInvitationService.generateLink.mockRejectedValue(error)

      await controller.generateInvitationLink(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith(error)
      expect(statusSpy).not.toHaveBeenCalled()
    })
  })

  describe('getInvitationStatus', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: 'invitation-123' }
      }
    })

    it('should return 200 with invitation status', async () => {
      const mockInvitation: InvitationResponse = {
        id: 'invitation-123',
        sender: '@user:example.com',
        recipient: 'test@example.com',
        medium: 'email',
        expiration: Date.now() + 86400000,
        accessed: false
      }
      mockInvitationService.getInvitationStatus.mockResolvedValue(
        mockInvitation
      )

      await controller.getInvitationStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith({
        invitation: mockInvitation
      })
    })

    it('should return 400 when invitation id is empty', async () => {
      mockRequest.params = { id: '' }

      await controller.getInvitationStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(400)
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Invitation id is required'
      })
    })

    it('should include matrix_id in response when invitation is accepted', async () => {
      const mockInvitation: InvitationResponse = {
        id: 'invitation-123',
        sender: '@user:example.com',
        recipient: 'test@example.com',
        medium: 'email',
        expiration: Date.now() + 86400000,
        accessed: true,
        matrix_id: '@newuser:example.com'
      }
      mockInvitationService.getInvitationStatus.mockResolvedValue(
        mockInvitation
      )

      await controller.getInvitationStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(jsonSpy).toHaveBeenCalledWith({
        invitation: expect.objectContaining({
          matrix_id: '@newuser:example.com',
          accessed: true
        })
      })
    })

    it('should delegate error handling to error middleware', async () => {
      const error = new Error('Service error')
      mockInvitationService.getInvitationStatus.mockRejectedValue(error)

      await controller.getInvitationStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith(error)
      expect(statusSpy).not.toHaveBeenCalled()
    })
  })

  describe('removeInvitation', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: 'invitation-123' }
      }
    })

    it('should return 200 with success message when removed', async () => {
      mockInvitationService.removeInvitation.mockResolvedValue(undefined)

      await controller.removeInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(statusSpy).toHaveBeenCalledWith(200)
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Invitation removed'
      })
    })

    it('should delegate error handling to error middleware', async () => {
      const error = new Error('Service error')
      mockInvitationService.removeInvitation.mockRejectedValue(error)

      await controller.removeInvitation(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalledWith(error)
      expect(statusSpy).not.toHaveBeenCalled()
    })
  })
})
