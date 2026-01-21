import DisplayNameController from '../controllers/index.ts'
import type DisplayNameService from '../services/index.ts'
import { errCodes } from '@twake-chat/utils'

describe('DisplayNameController', () => {
  let controller: DisplayNameController
  let mockService: Partial<DisplayNameService>
  let mockLogger: any
  let mockConfig: any
  let mockReq: any
  let mockRes: any
  let next: jest.Mock

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }
    mockConfig = {
      features: {
        matrix_profile_updates_allowed: true
      }
    }
    mockService = {
      update: jest.fn()
    }
    controller = new DisplayNameController(mockConfig, mockLogger)
    // Override the internal service with our mock
    ;(controller as any).displayNameService = mockService

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    next = jest.fn()
  })

  it('should return 400 if authorization header is missing', async () => {
    mockReq = {
      headers: {},
      userId: 'user1',
      params: { userId: 'user1' },
      body: { displayname: 'Alice' }
    }

    await controller.updateDisplayName(mockReq, mockRes, next)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith({
      errcode: errCodes.unAuthorized,
      error: 'Authorization header is required'
    })
  })

  it('should return 403 if matrix_profile_updates_allowed is false', async () => {
    mockConfig.features.matrix_profile_updates_allowed = false
    mockReq = {
      headers: { authorization: 'Bearer token' },
      userId: 'user1',
      params: { userId: 'user1' },
      body: { displayname: 'Alice' }
    }

    await controller.updateDisplayName(mockReq, mockRes, next)

    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      errcode: errCodes.forbidden,
      error: 'Profile fields are managed centrally via Common Settings'
    })
  })

  it('should return 403 if user tries to change another user’s display name', async () => {
    mockReq = {
      headers: { authorization: 'Bearer token' },
      userId: 'user1',
      params: { userId: 'user2' },
      body: { displayname: 'Alice' }
    }

    await controller.updateDisplayName(mockReq, mockRes, next)

    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      errcode: errCodes.forbidden,
      error: 'You are not allowed to change the display name of another user'
    })
  })

  it('should return 400 if userId is empty', async () => {
    mockReq = {
      headers: { authorization: 'Bearer token' },
      userId: '',
      params: { userId: '' },
      body: { displayname: 'Alice' }
    }

    await controller.updateDisplayName(mockReq, mockRes, next)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith({
      errcode: errCodes.invalidParam,
      error: 'Invalid user id'
    })
  })

  it('should return 400 if displayname is missing', async () => {
    mockReq = {
      headers: { authorization: 'Bearer token' },
      userId: 'user1',
      params: { userId: 'user1' },
      body: {}
    }

    await controller.updateDisplayName(mockReq, mockRes, next)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith({
      errcode: errCodes.missingParams,
      error: "Missing key 'displayname'"
    })
  })

  it('should call displayNameService.update and return 200 if successful', async () => {
    mockReq = {
      headers: { authorization: 'Bearer token' },
      userId: 'user1',
      params: { userId: 'user1' },
      body: { displayname: 'Alice' }
    }
    ;(mockService.update as jest.Mock).mockResolvedValue({ ok: true })

    await controller.updateDisplayName(mockReq, mockRes, next)

    expect(mockService.update).toHaveBeenCalledWith('user1', 'Alice')
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith({})
  })

  it('should return 500 if update fails', async () => {
    mockReq = {
      headers: { authorization: 'Bearer token' },
      userId: 'user1',
      params: { userId: 'user1' },
      body: { displayname: 'Alice' }
    }
    ;(mockService.update as jest.Mock).mockResolvedValue({
      ok: false,
      text: async () => 'DB error'
    })

    await controller.updateDisplayName(mockReq, mockRes, next)

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to update display name for user user1',
      'DB error'
    )
    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      errcode: errCodes.unknown,
      error: 'Failed to update display name'
    })
  })

  it('should call next with error if exception thrown', async () => {
    mockReq = {
      headers: { authorization: 'Bearer token' },
      userId: 'user1',
      params: { userId: 'user1' },
      body: { displayname: 'Alice' }
    }
    ;(mockService.update as jest.Mock).mockRejectedValue(new Error('fail'))

    await controller.updateDisplayName(mockReq, mockRes, next)

    expect(next).toHaveBeenCalled()
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error)
  })
})
