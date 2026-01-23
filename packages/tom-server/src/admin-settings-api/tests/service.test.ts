/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/dot-notation */
import AdminService from '../services'
import conf from '../../config.json'

interface MockLogger {
  info: jest.Mock
  warn: jest.Mock
  error: jest.Mock
}

const makeLogger = (): MockLogger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
})

describe('AdminService', () => {
  let service: AdminService
  let logger: MockLogger
  let mockTokenManager: {
    getToken: jest.Mock
    invalidateToken: jest.Mock
    getState: jest.Mock
    startTokenAcquisition: jest.Mock
    stopTokenAcquisition: jest.Mock
  }

  beforeEach(() => {
    logger = makeLogger()
    mockTokenManager = {
      getToken: jest.fn().mockResolvedValue('cached-token'),
      invalidateToken: jest.fn(),
      getState: jest.fn().mockReturnValue('ready'),
      startTokenAcquisition: jest.fn(),
      stopTokenAcquisition: jest.fn()
    }
    service = new AdminService(
      conf as any,
      logger as any,
      undefined,
      mockTokenManager as any
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.resetAllMocks()
  })

  describe('token caching behavior', () => {
    it('fetches token on first call and caches it', async () => {
      const t1 = await service['_getCachedToken']()
      const t2 = await service['_getCachedToken']()

      expect(t1).toBe('cached-token')
      expect(t2).toBe('cached-token')
      expect(mockTokenManager.getToken).toHaveBeenCalledTimes(2)
    })

    it('invalidates token via token manager', async () => {
      service['_invalidateToken']()

      expect(mockTokenManager.invalidateToken).toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalidating cached admin token'
      )
    })
  })

  describe('getTokenManager', () => {
    it('returns the token manager instance', () => {
      const tokenManager = service.getTokenManager()
      expect(tokenManager).toBeDefined()
      expect(typeof tokenManager.getToken).toBe('function')
      expect(typeof tokenManager.invalidateToken).toBe('function')
    })
  })

  describe('cleanup', () => {
    it('stops token acquisition', () => {
      service.cleanup()
      expect(mockTokenManager.stopTokenAcquisition).toHaveBeenCalled()
    })
  })

  describe('_doFetch', () => {
    it('calls fetch with proper headers', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true })
      global.fetch = mockFetch as any

      const token = 'abc'
      const res = await service['_doFetch'](
        'endpoint',
        { method: 'POST' },
        token
      )

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: `Bearer ${token}` })
        })
      )
      expect(res.ok).toBe(true)
    })
  })

  describe('makeRequestWithAdminToken', () => {
    it('returns response if status != 401', async () => {
      jest
        .spyOn(service as any, '_doFetch')
        .mockResolvedValue({ status: 200 } as any)

      const res = await service.makeRequestWithAdminToken('endpoint')
      expect(res.status).toBe(200)
    })

    it('retries on 401 and throws after maxRetries', async () => {
      jest
        .spyOn(service as any, '_doFetch')
        .mockResolvedValue({ status: 401 } as any)

      await expect(
        service.makeRequestWithAdminToken('endpoint', {}, 1)
      ).rejects.toThrow(/failed after 2 attempts/)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Received 401 Unauthorized (attempt 1)')
      )
    })
  })

  describe('_fetchAndUploadAvatar', () => {
    it('uploads avatar and returns MXC URL', async () => {
      const fakeMxc = 'mxc://example/avatar'
      const bufferMock = Buffer.from('test')
      const fetchResp: any = { ok: true, arrayBuffer: async () => bufferMock }
      const uploadResp: any = {
        ok: true,
        json: async () => ({ content_uri: fakeMxc })
      }

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchResp)
      jest
        .spyOn(service, 'makeRequestWithAdminToken')
        .mockResolvedValueOnce(uploadResp as any)

      const mxc = await service['_fetchAndUploadAvatar'](
        'http://avatar.url/img.png'
      )
      expect(mxc).toBe(fakeMxc)
    })

    it('throws if fetch fails', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'ERR'
      } as any)
      await expect(
        service['_fetchAndUploadAvatar']('http://avatar.url')
      ).rejects.toThrow('Failed to fetch avatar: 500 ERR')
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Avatar upload failed'),
        expect.any(Object)
      )
    })
  })

  describe('updateUserInformation', () => {
    it('sends displayName only if no avatarUrl', async () => {
      jest
        .spyOn(service, 'makeRequestWithAdminToken')
        .mockResolvedValue({ ok: true, json: async () => ({}) } as any)

      await service.updateUserInformation('user1', { displayName: 'Alice' })

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Updating user user1 profile with'),
        { displayname: 'Alice' }
      )
    })

    it('sends displayName and avatar_url if avatarUrl provided', async () => {
      const mxc = 'mxc://avatar'
      jest.spyOn(service as any, '_fetchAndUploadAvatar').mockResolvedValue(mxc)
      jest
        .spyOn(service, 'makeRequestWithAdminToken')
        .mockResolvedValue({ ok: true, json: async () => ({}) } as any)

      await service.updateUserInformation('user1', {
        displayName: 'Alice',
        avatarUrl: 'http://avatar.url'
      })

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Updating user user1 profile with'),
        { displayname: 'Alice', avatar_url: mxc }
      )
    })

    it('throws if makeRequestWithAdminToken fails', async () => {
      jest.spyOn(service, 'makeRequestWithAdminToken').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'ERR',
        json: async () => ({})
      } as any)

      await expect(
        service.updateUserInformation('user1', { displayName: 'Alice' })
      ).rejects.toThrow('Failed to update profile: 500 ERR')
    })
  })
})
