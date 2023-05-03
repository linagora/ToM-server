import PrivateNoteValidationMiddleware from '../middlewares/validation.middleware'
import type { AuthRequest } from '../types'
import type { Response, NextFunction } from 'express'
import type { IdentityServerDb } from '../../utils'

describe('Validation middlewares', () => {
  let mockRequest: Partial<AuthRequest>
  let mockResponse: Partial<Response>
  const nextFunction: NextFunction = jest.fn()

  const dbMock = {
    get: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    deleteEqual: jest.fn(),
    getCount: jest.fn()
  }

  const privateNoteValidationMiddlewareMock =
    new PrivateNoteValidationMiddleware(dbMock as unknown as IdentityServerDb)

  beforeEach(() => {
    mockRequest = {}
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    }
  })

  describe('checkGetRequirements middleware', () => {
    it('should call the next handler if requirements are met', () => {
      mockRequest = {
        query: {
          author: 'test',
          target: 'test'
        },
        userId: 'test'
      }

      privateNoteValidationMiddlewareMock.checkGetRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should return 400 if requirements are not met', () => {
      mockRequest = {
        query: {
          author: 'XXXX'
        },
        userId: 'XXXX'
      }

      privateNoteValidationMiddlewareMock.checkGetRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Bad Request' })
    })

    it('should not pass when the authenticated user is not the author of the note', () => {
      mockRequest = {
        query: {
          author: '1',
          target: 'someone'
        },
        userId: 'someone else'
      }

      privateNoteValidationMiddlewareMock.checkGetRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })

  describe('checkCreationRequirements middleware', () => {
    it('should call the next handler if requirements are met', () => {
      mockRequest = {
        body: {
          author: 'test',
          target: 'test',
          content: 'some note about a contact'
        },
        userId: 'test'
      }

      privateNoteValidationMiddlewareMock.checkCreationRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
      expect(mockResponse.status).not.toHaveBeenCalled()
    })

    it('should not pass when the connected user is not the author of the note', () => {
      mockRequest = {
        body: {
          author: 'test',
          content: 'something'
        },
        userId: 'test2'
      }

      privateNoteValidationMiddlewareMock.checkCreationRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
    it('should return 400 if requirements are not met', () => {
      mockRequest = {
        body: {
          author: 'test',
          idk: 'something'
        },
        userId: 'test'
      }

      privateNoteValidationMiddlewareMock.checkCreationRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })

  describe('checkDeleteRequirements middleware', () => {
    it('should call the next handler if requirements are met', async () => {
      mockRequest = {
        params: {
          id: '1'
        },
        userId: 'test'
      }

      dbMock.get.mockResolvedValue([
        {
          id: 1,
          authorId: 'test',
          content: 'hello',
          targetId: 'test'
        }
      ])

      await privateNoteValidationMiddlewareMock.checkDeleteRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
      expect(mockResponse.status).not.toHaveBeenCalled()
    })

    it('should not pass when note does not exist', async () => {
      mockRequest = {
        params: {
          id: 'test'
        },
        userId: 'test2'
      }

      dbMock.get.mockResolvedValue([])

      await privateNoteValidationMiddlewareMock.checkDeleteRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should not pass when something wrong happens', async () => {
      mockRequest = {
        params: {
          id: 'test'
        },
        userId: 'test2'
      }

      dbMock.get.mockRejectedValue(new Error('test'))

      await privateNoteValidationMiddlewareMock.checkDeleteRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })

  describe('checkUpdateRequirements middleware', () => {
    it('should call the next handler if requirements are met', async () => {
      mockRequest = {
        body: {
          content: 'hello',
          id: 'test'
        },
        userId: 'test'
      }

      dbMock.get.mockResolvedValue([
        {
          id: 1,
          authorId: 'test',
          content: 'hello',
          targetId: 'test'
        }
      ])

      await privateNoteValidationMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
      expect(mockResponse.status).not.toHaveBeenCalled()
    })

    it('should not pass when note does not exist', async () => {
      mockRequest = {
        body: {
          content: 'hello',
          id: 'test'
        },
        userId: 'test2'
      }

      dbMock.getCount.mockResolvedValue(0)

      await privateNoteValidationMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
    it('should not pass when something wrong happens', async () => {
      mockRequest = {
        body: {
          content: 'hello',
          id: 'test'
        },
        userId: 'test2'
      }

      dbMock.getCount.mockRejectedValue(new Error('test'))

      await privateNoteValidationMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should not pass when note is not from the connected user', async () => {
      mockRequest = {
        body: {
          content: 'hello',
          id: 'test'
        },
        userId: 'test2'
      }

      dbMock.get.mockResolvedValue([
        {
          id: 1,
          authorId: 'someonelese',
          content: 'hello',
          targetId: 'test'
        }
      ])

      await privateNoteValidationMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })
})
