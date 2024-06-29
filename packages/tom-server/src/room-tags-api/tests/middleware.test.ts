import type { MatrixDBBackend } from '@twake/matrix-identity-server'
import type { NextFunction, Response } from 'express'
import type { AuthRequest, TwakeDB } from '../../types'
import RoomTagsMiddleware from '../middlewares'

describe('the room tags API middleware', () => {
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

  const matrixDbMock = {
    get: jest.fn()
  }

  const roomTagsMiddlewareMock = new RoomTagsMiddleware(
    dbMock as unknown as TwakeDB,
    matrixDbMock as unknown as MatrixDBBackend
  )

  beforeEach(() => {
    mockRequest = {}
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('the checkFetchRequirements', () => {
    it('should call the next handler if the requirements are met', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        },
        userId: 'test'
      }

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      await roomTagsMiddlewareMock.checkFetchRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should return 400 if the roomId is not provided', async () => {
      mockRequest = {
        userId: 'test'
      }

      await roomTagsMiddlewareMock.checkFetchRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 403 if the user is not a member of the room', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        },
        userId: 'test'
      }

      matrixDbMock.get = jest.fn().mockResolvedValue([])

      await roomTagsMiddlewareMock.checkFetchRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(403)
    })

    it('should return 400 if the user is missing', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        }
      }

      await roomTagsMiddlewareMock.checkFetchRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })

  describe('the checkCreateRequirements', () => {
    it('should call the next handler if the requirements are met', async () => {
      mockRequest = {
        body: {
          roomId: '!room:example.org',
          content: ['tag1', 'tag2']
        },
        userId: 'test'
      }

      dbMock.get.mockResolvedValue([])

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      await roomTagsMiddlewareMock.checkCreateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should return 400 if the roomId is not provided', async () => {
      mockRequest = {
        body: {
          content: ['tag1', 'tag2']
        },
        userId: 'test'
      }
      dbMock.get.mockResolvedValue([])

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      await roomTagsMiddlewareMock.checkCreateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if the tags content is not an array', async () => {
      mockRequest = {
        body: {
          roomId: '!room:example.org',
          content: 'some string'
        },
        userId: 'test'
      }
      dbMock.get.mockResolvedValue([])

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      await roomTagsMiddlewareMock.checkCreateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if the tags content is not provided', async () => {
      mockRequest = {
        body: {
          roomId: '!room:example.org'
        },
        userId: 'test'
      }
      dbMock.get.mockResolvedValue([])

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      await roomTagsMiddlewareMock.checkCreateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 403 if the user is not a member of the room', async () => {
      mockRequest = {
        body: {
          roomId: '!room:example.org',
          content: ['tag1', 'tag2']
        },
        userId: 'test'
      }
      dbMock.get.mockResolvedValue([])

      matrixDbMock.get.mockResolvedValue([])

      await roomTagsMiddlewareMock.checkCreateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(403)
    })

    it('should return 400 if the user has already a tag for this room', async () => {
      mockRequest = {
        body: {
          roomId: '!room:example.org',
          content: ['tag1', 'tag2']
        },
        userId: 'test'
      }

      dbMock.get.mockResolvedValue([
        {
          userId: 'test',
          roomId: '!room:example.org',
          content: "['tag1', 'tag2']"
        }
      ])

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      await roomTagsMiddlewareMock.checkCreateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if any of the tags is not a string', async () => {
      mockRequest = {
        body: {
          roomId: '!room:example.org',
          content: ['tag1', 1]
        },
        userId: 'test'
      }

      dbMock.get.mockResolvedValue([])

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      await roomTagsMiddlewareMock.checkCreateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })

  describe('the checkUpdateRequirements', () => {
    it('should call the next handler if the requirements are met', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        },
        body: {
          content: ['tag1', 'tag2']
        },
        userId: 'test'
      }

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      dbMock.get.mockResolvedValue([
        {
          id: 1,
          userId: 'test',
          roomId: '!room:example.org',
          content: "['tag1']"
        }
      ])

      await roomTagsMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should return 400 if the roomId is not provided', async () => {
      mockRequest = {
        body: {
          content: ['tag1', 'tag2']
        },
        userId: 'test'
      }

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      dbMock.get.mockResolvedValue([
        {
          userId: 'test',
          roomId: '!room:example.org',
          content: "['tag1']"
        }
      ])

      await roomTagsMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if the content is not provided', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        },
        userId: 'test'
      }

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      dbMock.get.mockResolvedValue([
        {
          userId: 'test',
          roomId: '!room:example.org',
          content: "['tag1']"
        }
      ])

      await roomTagsMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if the content is not an array', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        },
        body: {
          content: 'some string'
        },
        userId: 'test'
      }

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      dbMock.get.mockResolvedValue([
        {
          userId: 'test',
          roomId: '!room:example.org',
          content: "['tag1']"
        }
      ])

      await roomTagsMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if any of the tags of content is not a string', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        },
        body: {
          content: ['tag1', 1]
        },
        userId: 'test'
      }

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      dbMock.get.mockResolvedValue([
        {
          userId: 'test',
          roomId: '!room:example.org',
          content: "['tag1']"
        }
      ])

      await roomTagsMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 403 if the user is not member of the room', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        },
        body: {
          content: ['tag1', 'tag2']
        },
        userId: 'test'
      }

      matrixDbMock.get.mockResolvedValue([])

      dbMock.get.mockResolvedValue([
        {
          userId: 'test',
          roomId: '!room:example.org',
          content: "['tag1']"
        }
      ])

      await roomTagsMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(403)
    })

    it('should return 400 if any of the room tags do not exist', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        },
        body: {
          content: ['tag1', 1]
        },
        userId: 'test'
      }

      matrixDbMock.get.mockResolvedValue([
        {
          user_id: 'test',
          room_id: '!room:example.org'
        }
      ])

      dbMock.get.mockResolvedValue([])

      await roomTagsMiddlewareMock.checkUpdateRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })

  describe('the checkDeleteRequirements', () => {
    it('should call the next handler if the requirements are met', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        },
        userId: 'test'
      }

      dbMock.get.mockResolvedValue([
        {
          userId: 'test',
          roomId: '!room:example.org',
          content: "['tag1']"
        }
      ])

      await roomTagsMiddlewareMock.checkDeleteRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
    })

    it('should return 400 if the roomId is not provided', async () => {
      mockRequest = {
        userId: 'test'
      }

      dbMock.get.mockResolvedValue([
        {
          userId: 'test',
          roomId: '!room:example.org',
          content: "['tag1']"
        }
      ])

      await roomTagsMiddlewareMock.checkDeleteRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if the userId is not provided', async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        }
      }

      dbMock.get.mockResolvedValue([
        {
          userId: 'test',
          roomId: '!room:example.org',
          content: "['tag1']"
        }
      ])

      await roomTagsMiddlewareMock.checkDeleteRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it("should return 400 if the room tag doesn't exist", async () => {
      mockRequest = {
        params: {
          roomId: '!room:example.org'
        },
        userId: 'test'
      }

      dbMock.get.mockResolvedValue([])

      await roomTagsMiddlewareMock.checkDeleteRequirements(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })
})
