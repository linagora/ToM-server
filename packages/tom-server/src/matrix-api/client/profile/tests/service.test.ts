import ProfileService from '../services'
import { AddressbookService } from '../../../../addressbook-api/services'

jest.mock('../../../../addressbook-api/services', () => ({
  AddressbookService: jest.fn().mockImplementation(() => ({
    getContact: jest.fn()
  }))
}))

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}

const mockDb = {}
const mockConfig = { matrix_internal_host: 'http://matrix.local' }

describe('ProfileService', () => {
  let service: ProfileService
  let mockAddressbook: any

  beforeEach(() => {
    jest.resetAllMocks()
    ;(AddressbookService as jest.Mock).mockImplementation(() => ({
      getContact: jest.fn()
    }))
    service = new ProfileService(
      mockConfig as any,
      mockLogger as any,
      mockDb as any
    )
    mockAddressbook = (service as any).addressBookService
  })

  describe('get', () => {
    it('should fetch user profile and merge contact display name if available', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          displayname: 'Matrix User',
          avatar_url: 'avatar.png'
        })
      }) as any

      mockAddressbook.getContact.mockResolvedValue({
        display_name: 'Contact Name'
      })

      const result = await service.get(
        '@user:matrix.local',
        '@viewer:matrix.local'
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'http://matrix.local/_matrix/client/v3/profile/%40user%3Amatrix.local',
        expect.objectContaining({ method: 'GET' })
      )
      expect(result).toEqual({
        displayname: 'Contact Name',
        avatar_url: 'avatar.png'
      })
    })

    it('should fallback to Matrix display name when contact not found', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ displayname: 'Matrix Fallback' })
      }) as any

      mockAddressbook.getContact.mockResolvedValue(null)

      const result = await service.get(
        '@user:matrix.local',
        '@viewer:matrix.local'
      )

      expect(result.displayname).toBe('Matrix Fallback')
    })

    it('should throw error when Matrix API fails', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 404 }) as any

      await expect(
        service.get('@user:matrix.local', '@viewer:matrix.local')
      ).rejects.toThrow(/404/)
    })
  })

  describe('getDisplayName', () => {
    it('should fetch user displayname and override with contact if available', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ displayname: 'Matrix Display' })
      }) as any

      mockAddressbook.getContact.mockResolvedValue({
        display_name: 'Contact Override'
      })

      const result = await service.getDisplayName(
        '@user:matrix.local',
        '@viewer:matrix.local'
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'http://matrix.local/_matrix/client/v3/profile/%40user%3Amatrix.local/displayname',
        expect.any(Object)
      )
      expect(result.displayname).toBe('Contact Override')
    })
  })

  describe('updateDisplayName', () => {
    it('should return a mock response with updated display name', async () => {
      const response = await service.updateDisplayName('@user:matrix.local', 'New Name')

      expect(response).toEqual(
        expect.objectContaining({
          ok: true,
          success: true,
          userId: '@user:matrix.local',
          displayName: 'New Name'
        })
      )
    })
  })
})
