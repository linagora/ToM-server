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

  beforeEach(() => {
    logger = makeLogger()
    service = new AdminService(conf as any, logger as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.resetAllMocks()
  })

  describe('_getAdminAccessToken', () => {
    it('throws if tokenService fails', async () => {
      jest.spyOn(service['tokenService'], 'getAccessTokenWithCreds').mockResolvedValue(null)

      await expect(service['_getAdminAccessToken']()).rejects.toThrow('Failed to get access token')
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to get access token'), expect.any(Object))
    })

    it('returns a token if tokenService succeeds', async () => {
      jest.spyOn(service['tokenService'], 'getAccessTokenWithCreds').mockResolvedValue('fake-token')
      const token = await service['_getAdminAccessToken']()
      expect(token).toBe('fake-token')
    })
  })

  describe('_getCachedToken and _invalidateToken', () => {
    it('fetches and caches a token if not cached', async () => {
      jest.spyOn(service as any, '_getAdminAccessToken').mockResolvedValue('cached-token')

      const t1 = await service['_getCachedToken']()
      const t2 = await service['_getCachedToken']()

      expect(t1).toBe('cached-token')
      expect(t2).toBe('cached-token')
      expect(logger.info).toHaveBeenCalledWith('Cached new admin token')
    })

    it('invalidates cached token', async () => {
      jest.spyOn(service as any, '_getAdminAccessToken').mockResolvedValue('token-to-invalidate')

      await service['_getCachedToken']()
      service['_invalidateToken']()

      expect(service['cache'].get(service['TOKEN_KEY'])).toBeUndefined()
      expect(logger.warn).toHaveBeenCalledWith('Invalidating cached admin token')
    })
  })

  describe('_doFetch', () => {
    it('calls fetch with proper headers', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true })
      global.fetch = mockFetch as any

      const token = 'abc'
      const res = await service['_doFetch']('endpoint', { method: 'POST' }, token)

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${token}` })
      }))
      expect(res.ok).toBe(true)
    })
  })

  describe('makeRequestWithAdminToken', () => {
    it('returns response if status != 401', async () => {
      jest.spyOn(service as any, '_getCachedToken').mockResolvedValue('token')
      jest.spyOn(service as any, '_doFetch').mockResolvedValue({ status: 200 } as any)

      const res = await service.makeRequestWithAdminToken('endpoint')
      expect(res.status).toBe(200)
    })

    it('retries on 401 and throws after maxRetries', async () => {
      jest.spyOn(service as any, '_getCachedToken').mockResolvedValue('token')
      jest.spyOn(service as any, '_doFetch').mockResolvedValue({ status: 401 } as any)

      await expect(service.makeRequestWithAdminToken('endpoint', {}, 1)).rejects.toThrow(
        /failed after 2 attempts/
      )
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Received 401 Unauthorized (attempt 1)'))
    })
  })

  describe('_fetchAndUploadAvatar', () => {
    it('uploads avatar and returns MXC URL', async () => {
      const fakeMxc = 'mxc://example/avatar'
      const bufferMock = Buffer.from('test')
      const fetchResp: any = { ok: true, arrayBuffer: async () => bufferMock }
      const uploadResp: any = { ok: true, json: async () => ({ content_uri: fakeMxc }) }

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchResp)
      jest.spyOn(service, 'makeRequestWithAdminToken').mockResolvedValueOnce(uploadResp as any)

      const mxc = await service['_fetchAndUploadAvatar']('http://avatar.url/img.png')
      expect(mxc).toBe(fakeMxc)
    })

    it('throws if fetch fails', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 500, statusText: 'ERR' } as any)
      await expect(service['_fetchAndUploadAvatar']('http://avatar.url')).rejects.toThrow('Failed to fetch avatar: 500 ERR')
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Avatar upload failed'), expect.any(Object))
    })
  })

  describe('updateUserInformation', () => {
    it('sends displayName only if no avatarUrl', async () => {
      jest.spyOn(service, 'makeRequestWithAdminToken').mockResolvedValue({ ok: true, json: async () => ({}) } as any)

      await service.updateUserInformation('user1', { displayName: 'Alice' })

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Updating user user1 profile with'), { displayname: 'Alice' })
    })

    it('sends displayName and avatar_url if avatarUrl provided', async () => {
      const mxc = 'mxc://avatar'
      jest.spyOn(service as any, '_fetchAndUploadAvatar').mockResolvedValue(mxc)
      jest.spyOn(service, 'makeRequestWithAdminToken').mockResolvedValue({ ok: true, json: async () => ({}) } as any)

      await service.updateUserInformation('user1', { displayName: 'Alice', avatarUrl: 'http://avatar.url' })

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Updating user user1 profile with'), { displayname: 'Alice', avatar_url: mxc })
    })

    it('throws if makeRequestWithAdminToken fails', async () => {
      jest.spyOn(service, 'makeRequestWithAdminToken').mockResolvedValue({ ok: false, status: 500, statusText: 'ERR', json: async () => ({}) } as any)

      await expect(service.updateUserInformation('user1', { displayName: 'Alice' })).rejects.toThrow('Failed to update profile: 500 ERR')
    })
  })
})
