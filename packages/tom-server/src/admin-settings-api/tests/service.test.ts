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

describe('the admin settings API service', () => {
  let service: AdminService
  let logger: MockLogger

  beforeEach(() => {
    logger = makeLogger()
    service = new AdminService(conf as any, logger as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('the _getAdminAccessToken method', () => {
    it('should return null if the token service fails', async () => {
      jest
        .spyOn(service['tokenService'], 'getAccessTokenWithCreds')
        .mockResolvedValue(null)

      await expect(service['_getAdminAccessToken']()).rejects.toThrow(
        'Failed to get access token'
      )
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get access token'),
        expect.any(Object)
      )
    })

    it('should return a token if the token service succeeds', async () => {
      jest
        .spyOn(service['tokenService'], 'getAccessTokenWithCreds')
        .mockResolvedValue('fake-token')

      const token = await service['_getAdminAccessToken']()
      expect(token).toBe('fake-token')
    })
  })

  describe('the _getCachedToken and _invalidateToken methods', () => {
    it('should fetch and cache a new token if none is cached', async () => {
      jest
        .spyOn(service as any, '_getAdminAccessToken')
        .mockResolvedValue('cached-token')

      const token1 = await service['_getCachedToken']()
      const token2 = await service['_getCachedToken']()

      expect(token1).toBe('cached-token')
      expect(token2).toBe('cached-token') // should use cached token
      expect(logger.info).toHaveBeenCalledWith('Cached new admin token')
    })

    it('should invalidate cached token', async () => {
      jest
        .spyOn(service as any, '_getAdminAccessToken')
        .mockResolvedValue('token-to-invalidate')

      const token = await service['_getCachedToken']()
      expect(token).toBe('token-to-invalidate')

      service['_invalidateToken']()
      expect(service['cache'].get(service['TOKEN_KEY'])).toBeUndefined()
    })
  })

  describe('updateUserInformation', () => {
    it('should call makeRequestWithAdminToken with displayName only', async () => {
      const mockFetch = jest
        .spyOn(service, 'makeRequestWithAdminToken')
        .mockResolvedValue({
          ok: true,
          json: async () => ({})
        } as any)

      await service.updateUserInformation('user1', { displayName: 'Alice' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/_synapse/admin/v2/users/user1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ displayname: 'Alice' })
        })
      )
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Updating user user1 profile with'),
        { displayname: 'Alice' }
      )
    })

    it('should throw if makeRequestWithAdminToken fails', async () => {
      jest
        .spyOn(service, 'makeRequestWithAdminToken')
        .mockResolvedValue({ ok: false, status: 500, statusText: 'ERR', json: async () => ({}) } as any)

      await expect(
        service.updateUserInformation('user1', { displayName: 'Alice' })
      ).rejects.toThrow('Failed to update profile: 500 ERR')
    })
  })
})
