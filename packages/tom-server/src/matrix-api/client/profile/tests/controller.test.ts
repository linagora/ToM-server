import { TwakeDB } from '../../../../types'
import ProfileController from '../controllers'
import type ProfileService from '../services'
import { errCodes } from '@twake/utils'

const dbMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

describe('ProfileController', () => {
  let controller: ProfileController
  let mockService: Partial<ProfileService>
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
      updateDisplayName: jest.fn(),
      get: jest.fn(),
      getDisplayName: jest.fn()
    }
    controller = new ProfileController(
      mockConfig,
      mockLogger,
      dbMock as unknown as TwakeDB
    )
    ;(controller as any).profileService = mockService

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    next = jest.fn()
  })

  describe('get', () => {
    it('should return 400 if viewer missing', async () => {
      mockReq = { userId: null, params: { userId: 'u1' } }
      await controller.get(mockReq, mockRes, next)
      expect(mockRes.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if userId missing', async () => {
      mockReq = { userId: 'viewer', params: {} }
      await controller.get(mockReq, mockRes, next)
      expect(mockRes.status).toHaveBeenCalledWith(400)
    })

    it('should return 200 with profile if successful', async () => {
      const fakeProfile = { displayname: 'Dr Who' }
      ;(mockService.get as jest.Mock).mockResolvedValue(fakeProfile)

      mockReq = { userId: 'viewer', params: { userId: 'target' } }

      await controller.get(mockReq, mockRes, next)
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(fakeProfile)
    })

    it('should handle 404 error', async () => {
      const error = new Error('404')
      ;(mockService.get as jest.Mock).mockRejectedValue(error)

      mockReq = { userId: 'viewer', params: { userId: 'target' } }

      await controller.get(mockReq, mockRes, next)
      expect(mockRes.status).toHaveBeenCalledWith(404)
    })
  })

  describe('getDisplayName', () => {
    it('should return 400 if viewer missing', async () => {
      mockReq = { userId: null, params: { userId: 'u1' } }
      await controller.getDisplayName(mockReq, mockRes, next)
      expect(mockRes.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if userId missing', async () => {
      mockReq = { userId: 'viewer', params: {} }
      await controller.getDisplayName(mockReq, mockRes, next)
      expect(mockRes.status).toHaveBeenCalledWith(400)
    })

    it('should return 200 if successful', async () => {
      const fakeProfile = { displayname: 'Dr Who' }
      ;(mockService.getDisplayName as jest.Mock).mockResolvedValue(fakeProfile)

      mockReq = { userId: 'viewer', params: { userId: 'target' } }

      await controller.getDisplayName(mockReq, mockRes, next)
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(fakeProfile)
    })

    it('should handle unauthorized error', async () => {
      const error = new Error('401')
      ;(mockService.getDisplayName as jest.Mock).mockRejectedValue(error)

      mockReq = { userId: 'viewer', params: { userId: 'target' } }

      await controller.getDisplayName(mockReq, mockRes, next)
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        errcode: errCodes.unAuthorized,
        error: 'Unauthorized to access Matrix profile'
      })
    })
  })

  describe('updateDisplayName', () => {
    it('should return 400 if authorization header is missing', async () => {
      mockReq = {
        headers: {},
        userId: 'user1',
        params: { userId: 'user1' },
        body: { displayname: 'Alice' }
      }

      await controller.updateDisplayName(mockReq, mockRes, next)
      expect(mockRes.status).toHaveBeenCalledWith(400)
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
    })

    it('should call displayNameService.update and return 200 if successful', async () => {
      mockReq = {
        headers: { authorization: 'Bearer token' },
        userId: 'user1',
        params: { userId: 'user1' },
        body: { displayname: 'Alice' }
      }
      ;(mockService.updateDisplayName as jest.Mock).mockResolvedValue({ ok: true })

      await controller.updateDisplayName(mockReq, mockRes, next)
      expect(mockService.updateDisplayName).toHaveBeenCalledWith('user1', 'Alice')
      expect(mockRes.status).toHaveBeenCalledWith(200)
    })

    it('should return 500 if update fails', async () => {
      mockReq = {
        headers: { authorization: 'Bearer token' },
        userId: 'user1',
        params: { userId: 'user1' },
        body: { displayname: 'Alice' }
      }
      ;(mockService.updateDisplayName as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => 'DB error'
      })

      await controller.updateDisplayName(mockReq, mockRes, next)
      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(500)
    })

    it('should call next with error if exception thrown', async () => {
      mockReq = {
        headers: { authorization: 'Bearer token' },
        userId: 'user1',
        params: { userId: 'user1' },
        body: { displayname: 'Alice' }
      }
      ;(mockService.updateDisplayName as jest.Mock).mockRejectedValue(new Error('fail'))

      await controller.updateDisplayName(mockReq, mockRes, next)
      expect(next).toHaveBeenCalled()
    })
  })
})
