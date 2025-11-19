import { _search } from '../_search'
import { send, errMsg, toMatrixId } from '@twake/utils'
import { AddressbookService } from '../../../addressbook-api/services'
import UserInfoService from '../../../user-info-api/services'

// Mock @twake/utils
jest.mock('@twake/utils', () => ({
  send: jest.fn(),
  errMsg: jest.fn((msg) => ({ error: msg })),
  toMatrixId: jest.fn((uid, server) => `@${uid}:${server}`),
  getLocalPart: jest.fn((mxid) => {
    if (!mxid) return null
    const match = mxid.match(/^@?([^:]+)/)
    return match ? match[1] : null
  })
}))

// Mock AddressbookService
const mockAddressbookList = jest.fn().mockResolvedValue({ contacts: [] })

jest.mock('../../../addressbook-api/services', () => ({
  AddressbookService: jest.fn().mockImplementation(() => ({
    list: mockAddressbookList
  }))
}))

// Mock UserInfoService
const mockUserInfoGet = jest
  .fn()
  .mockImplementation((address: string, viewer?: string) => {
    if (!address) return Promise.resolve(null)
    const uid = address.includes('@')
      ? address.replace(/^@(.*?):.*/, '$1')
      : address
    return Promise.resolve({
      uid,
      display_name: 'Dr Who',
      avatar_url: 'mxc://server/avatar123',
      first_name: 'Dr',
      last_name: 'Who',
      emails: ['drwho@docker.localhost'],
      phones: ['1234567890'],
      language: 'en',
      timezone: 'UTC'
    })
  })

jest.mock('../../../user-info-api/services', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(function MockUserInfoService() {
      return {
        get: mockUserInfoGet
      }
    })
  }
})

describe('_search factory', () => {
  const logger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }

  const idServerMock = {
    userDB: {
      match: jest.fn().mockResolvedValue([{ uid: 'drwho' }]),
      getAll: jest.fn().mockResolvedValue([{ uid: 'drwho' }])
    },
    db: {},
    matrixDb: {
      get: jest.fn().mockResolvedValue([{ name: '@drwho:server' }])
    },
    conf: { server_name: 'server', additional_features: true },
    logger
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockAddressbookList.mockResolvedValue({ contacts: [] })
    mockUserInfoGet.mockImplementation((address: string) => {
      if (!address) return Promise.resolve(null)
      const uid = address.includes('@')
        ? address.replace(/^@(.*?):.*/, '$1')
        : address
      return Promise.resolve({
        uid,
        display_name: 'Dr Who',
        avatar_url: 'mxc://server/avatar123',
        first_name: 'Dr',
        last_name: 'Who',
        emails: ['drwho@docker.localhost'],
        phones: ['1234567890'],
        language: 'en',
        timezone: 'UTC'
      })
    })
  })

  describe('Basic functionality', () => {
    it('should return matches and inactive matches successfully', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: 'drwho',
        owner: 'user123',
        offset: 0,
        limit: 10
      }

      await searchFn(resMock, dataMock)

      expect(send).toHaveBeenCalledWith(
        resMock,
        200,
        expect.objectContaining({
          matches: expect.any(Array),
          inactive_matches: expect.any(Array)
        })
      )

      expect(idServerMock.userDB.match).toHaveBeenCalled()
      expect(idServerMock.matrixDb.get).toHaveBeenCalled()
      expect(AddressbookService).toHaveBeenCalled()
      expect(UserInfoService).toHaveBeenCalled()
    })

    it('should return empty matches if no users or contacts found', async () => {
      const emptyServer = {
        ...idServerMock,
        userDB: {
          match: jest.fn().mockResolvedValue([]),
          getAll: jest.fn().mockResolvedValue([])
        },
        matrixDb: { get: jest.fn().mockResolvedValue([]) }
      }

      const searchFn = await _search(emptyServer as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: 'nomatch',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      expect(send).toHaveBeenCalledWith(resMock, 200, {
        matches: [],
        inactive_matches: []
      })
    })
  })

  describe('Validation', () => {
    it('should return 400 if invalid field or scope detected', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['invalidField'],
        scope: ['invalidScope'],
        val: 'drwho'
      }

      await searchFn(resMock, dataMock)

      expect(send).toHaveBeenCalledWith(resMock, 400, { error: 'invalidParam' })
    })

    it('should handle missing fields gracefully', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      expect(send).toHaveBeenCalledWith(
        resMock,
        200,
        expect.objectContaining({
          matches: expect.any(Array),
          inactive_matches: expect.any(Array)
        })
      )
    })
  })

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const brokenIdServer = {
        ...idServerMock,
        userDB: {
          match: jest.fn().mockRejectedValue(new Error('DB error')),
          getAll: jest.fn()
        }
      }

      const searchFn = await _search(brokenIdServer as any, logger as any)
      const resMock = {} as any

      await searchFn(resMock, {
        fields: ['uid'],
        scope: ['uid'],
        val: 'test'
      })

      expect(send).toHaveBeenCalledWith(resMock, 500, { error: 'invalidParam' })
    })

    it('should handle UserInfoService errors gracefully', async () => {
      mockUserInfoGet.mockRejectedValueOnce(new Error('UserInfo fetch failed'))

      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: 'drwho',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[_search] Failed to enrich'),
        expect.any(Object)
      )
      expect(send).toHaveBeenCalledWith(
        resMock,
        200,
        expect.objectContaining({
          matches: expect.any(Array),
          inactive_matches: expect.any(Array)
        })
      )
    })
  })

  describe('User enrichment', () => {
    it('should enrich returned users using UserInfoService', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: 'drwho',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      const sendCalls = (send as jest.Mock).mock.calls
      const response = sendCalls[sendCalls.length - 1][2]

      expect(mockUserInfoGet).toHaveBeenCalled()
      expect(
        response.matches.length + response.inactive_matches.length
      ).toBeGreaterThan(0)

      const allResults = [...response.matches, ...response.inactive_matches]
      const firstMatch = allResults[0]

      expect(firstMatch.uid).toBe('drwho')
      expect(firstMatch.address).toBe('@drwho:server')

      // UserInfoService enrichment fields
      expect(firstMatch).toHaveProperty('display_name')
      expect(firstMatch).toHaveProperty('avatar_url')
      expect(firstMatch).toHaveProperty('first_name')
      expect(firstMatch).toHaveProperty('last_name')
      expect(firstMatch).toHaveProperty('emails')
      expect(firstMatch).toHaveProperty('phones')
      expect(firstMatch).toHaveProperty('mail')
      expect(firstMatch).toHaveProperty('mobile')
      expect(firstMatch).toHaveProperty('language')
      expect(firstMatch).toHaveProperty('timezone')
    })

    it('should include deprecated field mappings for backward compatibility', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: 'drwho',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      const sendCalls = (send as jest.Mock).mock.calls
      const response = sendCalls[sendCalls.length - 1][2]
      const allResults = [...response.matches, ...response.inactive_matches]
      const firstMatch = allResults[0]

      // Check deprecated fields exist
      expect(firstMatch).toHaveProperty('displayName')
      expect(firstMatch).toHaveProperty('givenName')
      expect(firstMatch).toHaveProperty('givenname')
      expect(firstMatch).toHaveProperty('cn')
    })

    it('should add address field with Matrix ID to results', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: 'drwho',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      const sendCalls = (send as jest.Mock).mock.calls
      const response = sendCalls[sendCalls.length - 1][2]
      const allResults = [...response.matches, ...response.inactive_matches]
      const firstMatch = allResults[0]

      expect(firstMatch.address).toBe('@drwho:server')
    })
  })

  describe('AddressBook integration', () => {
    it('should use only AddressBook when additional_features is false', async () => {
      const idServerWithoutUserDB = {
        ...idServerMock,
        conf: { server_name: 'server', additional_features: false }
      }

      const searchFn = await _search(
        idServerWithoutUserDB as any,
        logger as any
      )
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: 'contact',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      expect(idServerWithoutUserDB.userDB.match).not.toHaveBeenCalled()
      expect(AddressbookService).toHaveBeenCalled()
      expect(send).toHaveBeenCalledWith(
        resMock,
        200,
        expect.objectContaining({
          matches: expect.any(Array),
          inactive_matches: expect.any(Array)
        })
      )
    })

    it('should merge contacts from AddressBook with userDB results', async () => {
      mockAddressbookList.mockResolvedValueOnce({
        contacts: [
          {
            mxid: '@contact1:server',
            display_name: 'Contact One'
          }
        ]
      })

      const emptyUserServer = {
        ...idServerMock,
        userDB: {
          match: jest.fn().mockResolvedValue([]),
          getAll: jest.fn().mockResolvedValue([])
        },
        matrixDb: {
          get: jest.fn().mockResolvedValue([])
        }
      }

      const searchFn = await _search(emptyUserServer as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: 'contact',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      expect(mockAddressbookList).toHaveBeenCalledWith('user123')
      const sendCalls = (send as jest.Mock).mock.calls
      const response = sendCalls[sendCalls.length - 1][2]

      expect(send).toHaveBeenCalledWith(
        resMock,
        200,
        expect.objectContaining({
          matches: expect.any(Array),
          inactive_matches: expect.any(Array)
        })
      )

      // Contact should be in matches
      expect(response.matches.length).toBeGreaterThan(0)
      const contact = response.matches.find((m: any) => m.uid === 'contact1')
      expect(contact).toBeDefined()
      expect(contact.address).toBe('@contact1:server')
    })
  })

  describe('Search parameters', () => {
    it('should handle pagination with offset and limit', async () => {
      const multiUserServer = {
        ...idServerMock,
        userDB: {
          match: jest
            .fn()
            .mockResolvedValue([
              { uid: 'user1' },
              { uid: 'user2' },
              { uid: 'user3' },
              { uid: 'user4' },
              { uid: 'user5' }
            ]),
          getAll: jest.fn()
        },
        matrixDb: {
          get: jest
            .fn()
            .mockResolvedValue([
              { name: '@user1:server' },
              { name: '@user2:server' },
              { name: '@user3:server' }
            ])
        }
      }

      const searchFn = await _search(multiUserServer as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: 'user',
        owner: 'admin',
        offset: 1,
        limit: 2
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      const totalResults =
        response.matches.length + response.inactive_matches.length

      expect(totalResults).toBe(2)
    })

    it('should normalize matrixAddress scope to uid', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['matrixAddress'],
        val: 'drwho',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      expect(send).toHaveBeenCalledWith(
        resMock,
        200,
        expect.objectContaining({
          matches: expect.any(Array),
          inactive_matches: expect.any(Array)
        })
      )
      expect(idServerMock.userDB.match).toHaveBeenCalledWith(
        'users',
        ['uid'],
        ['uid'],
        'drwho',
        'uid'
      )
    })

    it('should strip Matrix ID prefix from search value', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: '@drwho:server.com',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      expect(idServerMock.userDB.match).toHaveBeenCalledWith(
        'users',
        ['uid'],
        ['uid'],
        'drwho',
        'uid'
      )
    })

    it('should return all users when val is empty', async () => {
      const getAllServer = {
        ...idServerMock,
        userDB: {
          match: jest.fn(),
          getAll: jest.fn().mockResolvedValue([{ uid: 'drwho' }])
        }
      }

      const searchFn = await _search(getAllServer as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        fields: ['uid'],
        scope: ['uid'],
        val: '',
        owner: 'user123'
      }

      await searchFn(resMock, dataMock)

      expect(getAllServer.userDB.getAll).toHaveBeenCalledWith(
        'users',
        ['uid'],
        'uid'
      )
      expect(send).toHaveBeenCalledWith(
        resMock,
        200,
        expect.objectContaining({
          matches: expect.any(Array),
          inactive_matches: expect.any(Array)
        })
      )
    })
  })
})
