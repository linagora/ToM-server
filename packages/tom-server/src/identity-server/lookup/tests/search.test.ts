import { _search } from '../_search'
import { send, isMatrixId } from '@twake/utils'

// Mock @twake/utils
jest.mock('@twake/utils', () => ({
  send: jest.fn(),
  errMsg: jest.fn((msg) => ({ error: msg })),
  toMatrixId: jest.fn((uid, server) => `@${uid}:${server}`),
  isMatrixId: jest.fn((id) => {
    if (!id || typeof id !== 'string') return false
    return /^@[^:]+:[^:]+$/.test(id)
  }),
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
      display_name: `Display ${uid}`,
      avatar_url: `mxc://server/avatar_${uid}`,
      first_name: 'First',
      last_name: 'Last',
      emails: [`${uid}@example.com`],
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
    info: jest.fn(),
    silly: jest.fn()
  }

  const idServerMock = {
    userDB: {
      match: jest.fn().mockResolvedValue([{ uid: 'drwho' }])
    },
    db: {},
    matrixDb: {
      db: {
        match: jest.fn().mockResolvedValue([{ user_id: '@drwho:server' }])
      }
    },
    conf: {
      server_name: 'server',
      additional_features: true,
      features: { user_directory: { enabled: true } }
    },
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
        display_name: `Display ${uid}`,
        avatar_url: `mxc://server/avatar_${uid}`,
        first_name: 'First',
        last_name: 'Last',
        emails: [`${uid}@example.com`],
        phones: ['1234567890'],
        language: 'en',
        timezone: 'UTC'
      })
    })
    ;(isMatrixId as jest.Mock).mockImplementation((id) => {
      if (!id || typeof id !== 'string') return false
      return /^@[^:]+:[^:]+$/.test(id)
    })
  })

  describe('Basic search functionality', () => {
    it('should return matches and inactive matches successfully', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
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

      const response = (send as jest.Mock).mock.calls[0][2]
      expect(
        response.matches.length + response.inactive_matches.length
      ).toBeGreaterThan(0)
    })

    it('should return empty matches when no users found', async () => {
      const emptyServer = {
        ...idServerMock,
        userDB: {
          match: jest.fn().mockResolvedValue([])
        },
        matrixDb: {
          db: {
            match: jest.fn().mockResolvedValue([])
          }
        }
      }

      const searchFn = await _search(emptyServer as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'nomatch',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      expect(send).toHaveBeenCalledWith(resMock, 200, {
        matches: [],
        inactive_matches: []
      })
    })

    it('should handle search without predicate', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: '',
        owner: '@user123:server'
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

    it('should handle search without owner', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: ''
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

  describe('MatrixDb integration', () => {
    it('should convert non-Matrix IDs to Matrix IDs', async () => {
      const serverWithLocalId = {
        ...idServerMock,
        matrixDb: {
          db: {
            match: jest.fn().mockResolvedValue([{ user_id: 'localuser' }])
          }
        }
      }

      const searchFn = await _search(serverWithLocalId as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'local',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      expect(
        response.matches.length + response.inactive_matches.length
      ).toBeGreaterThan(0)
    })

    it('should skip matrixDb when user_directory is disabled', async () => {
      const serverNoFeatures = {
        ...idServerMock,
        conf: {
          server_name: 'server',
          additional_features: false,
          features: { user_directory: { enabled: false } }
        },
        userDB: {
          match: jest.fn().mockResolvedValue([])
        },
        matrixDb: {
          db: {
            match: jest.fn().mockResolvedValue([{ user_id: '@drwho:server' }])
          }
        }
      }

      const searchFn = await _search(serverNoFeatures as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'test',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      // matrixDb.match should not have been called
      expect(serverNoFeatures.matrixDb.db.match).not.toHaveBeenCalled()

      expect(send).toHaveBeenCalledWith(
        resMock,
        200,
        expect.objectContaining({
          matches: expect.any(Array),
          inactive_matches: expect.any(Array)
        })
      )
    })

    it('should skip matrixDb when user_directory is disabled via env', async () => {
      const originalEnv = process.env.ADDITIONAL_FEATURES
      process.env.ADDITIONAL_FEATURES = 'false'

      const serverNoEnvFeatures = {
        ...idServerMock,
        conf: {
          server_name: 'server',
          additional_features: false,
          features: { user_directory: { enabled: false } }
        },
        userDB: {
          match: jest.fn().mockResolvedValue([])
        },
        matrixDb: {
          db: {
            match: jest.fn().mockResolvedValue([{ user_id: '@drwho:server' }])
          }
        }
      }

      const searchFn = await _search(serverNoEnvFeatures as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'test',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      // matrixDb.match should not have been called
      expect(serverNoEnvFeatures.matrixDb.db.match).not.toHaveBeenCalled()

      // Restore original env
      if (originalEnv !== undefined) {
        process.env.ADDITIONAL_FEATURES = originalEnv
      } else {
        delete process.env.ADDITIONAL_FEATURES
      }
    })

    it('should query matrixDb when user_directory is enabled', async () => {
      const serverWithFeatures = {
        ...idServerMock,
        conf: {
          server_name: 'server',
          additional_features: false,
          features: { user_directory: { enabled: true } }
        },
        userDB: {
          match: jest.fn().mockResolvedValue([])
        },
        matrixDb: {
          db: {
            match: jest.fn().mockResolvedValue([{ user_id: '@drwho:server' }])
          }
        }
      }

      const searchFn = await _search(serverWithFeatures as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      // matrixDb.match should have been called
      expect(serverWithFeatures.matrixDb.db.match).toHaveBeenCalled()
    })

    it('should query matrixDb when user_directory is enabled via config', async () => {
      const serverWithEnvFeatures = {
        ...idServerMock,
        conf: {
          server_name: 'server',
          additional_features: false,
          features: { user_directory: { enabled: true } }
        },
        userDB: {
          match: jest.fn().mockResolvedValue([])
        },
        matrixDb: {
          db: {
            match: jest.fn().mockResolvedValue([{ user_id: '@drwho:server' }])
          }
        }
      }

      const searchFn = await _search(
        serverWithEnvFeatures as any,
        logger as any
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      // matrixDb.match should have been called
      expect(serverWithEnvFeatures.matrixDb.db.match).toHaveBeenCalled()
    })

    it('should handle matrixDb errors gracefully', async () => {
      const brokenMatrixServer = {
        ...idServerMock,
        matrixDb: {
          db: {
            match: jest.fn().mockRejectedValue(new Error('MatrixDb error'))
          }
        }
      }

      const searchFn = await _search(brokenMatrixServer as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'test',
        owner: '@user123:server'
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

  describe('UserDB integration', () => {
    it('should skip userDB when additional_features is disabled', async () => {
      const serverNoFeatures = {
        ...idServerMock,
        conf: {
          server_name: 'server',
          additional_features: false,
          features: { user_directory: { enabled: false } }
        },
        userDB: {
          match: jest.fn().mockResolvedValue([{ uid: 'drwho' }])
        }
      }

      const searchFn = await _search(serverNoFeatures as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'test',
        owner: '@user123:server'
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

    it('should handle userDB errors gracefully', async () => {
      const brokenUserServer = {
        ...idServerMock,
        userDB: {
          match: jest.fn().mockRejectedValue(new Error('UserDB error'))
        }
      }

      const searchFn = await _search(brokenUserServer as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'test',
        owner: '@user123:server'
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

  describe('AddressBook integration', () => {
    it('should include addressbook contacts in results', async () => {
      mockAddressbookList.mockResolvedValueOnce({
        contacts: [
          {
            mxid: '@drwho:server',
            display_name: 'Dr Who'
          },
          {
            mxid: '@janedoe:server',
            display_name: 'Jane Doe'
          },
          {
            mxid: '@johndoe:server',
            display_name: 'John Doe'
          }
        ]
      })

      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      const allResults = [...response.matches, ...response.inactive_matches]
      const drwhoResult = allResults.find((r: any) => r.uid === '@drwho:server')
      expect(drwhoResult).toBeDefined()
    })

    it('should return nothing when no predicate provided', async () => {
      // Note: This mock won't be consumed because empty predicate returns early
      // We keep it here for clarity but it doesn't affect the test

      const emptyDbServer = {
        ...idServerMock,
        userDB: { match: jest.fn().mockResolvedValue([]) },
        matrixDb: { db: { match: jest.fn().mockResolvedValue([]) } }
      }

      const searchFn = await _search(emptyDbServer as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: '',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      expect(response.matches.length).toBe(0)
      expect(response.inactive_matches.length).toBe(0)
    })

    it('should filter out invalid Matrix IDs from addressbook', async () => {
      mockAddressbookList.mockResolvedValueOnce({
        contacts: [
          { mxid: '@valid:server', display_name: 'Valid' },
          { mxid: 'invalid', display_name: 'Invalid' },
          { mxid: '', display_name: 'Empty' },
          { mxid: null, display_name: 'Null' }
        ]
      })

      const emptyDbServer = {
        ...idServerMock,
        userDB: { match: jest.fn().mockResolvedValue([]) },
        matrixDb: { db: { match: jest.fn().mockResolvedValue([]) } }
      }

      const searchFn = await _search(emptyDbServer as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'al',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      const allResults = [...response.matches, ...response.inactive_matches]
      expect(allResults.length).toBe(1)
      expect(allResults[0].uid).toBe('@valid:server')
    })

    it('should handle addressbook errors gracefully', async () => {
      mockAddressbookList.mockRejectedValueOnce(new Error('AddressBook error'))

      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'test',
        owner: '@user123:server'
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

  describe('Active vs Inactive user distinction', () => {
    it('should mark users found in matrixDb as active', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      expect(response.matches.length).toBeGreaterThan(0)
      expect(
        response.matches.some(
          (m: any) => m.uid === '@drwho:server' || m.address === '@drwho:server'
        )
      ).toBe(true)
    })

    it('should mark users only in userDB as inactive', async () => {
      const serverWithInactiveUser = {
        ...idServerMock,
        matrixDb: {
          db: {
            match: jest.fn().mockResolvedValue([{ user_id: '@active:server' }])
          }
        },
        userDB: {
          match: jest
            .fn()
            .mockResolvedValue([{ uid: 'active' }, { uid: 'inactive' }])
        }
      }

      const searchFn = await _search(
        serverWithInactiveUser as any,
        logger as any
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'user',
        owner: '@admin:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      expect(response.inactive_matches.length).toBeGreaterThan(0)
      expect(
        response.inactive_matches.some((m: any) => m.uid === '@inactive:server')
      ).toBe(true)
    })

    it('should not duplicate users between active and inactive lists', async () => {
      const serverWithDuplicates = {
        ...idServerMock,
        matrixDb: {
          db: {
            match: jest.fn().mockResolvedValue([{ user_id: '@drwho:server' }])
          }
        },
        userDB: {
          match: jest.fn().mockResolvedValue([{ uid: 'drwho' }])
        }
      }

      const searchFn = await _search(serverWithDuplicates as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      const allResults = [...response.matches, ...response.inactive_matches]
      const drwhoResults = allResults.filter(
        (r: any) => r.uid === '@drwho:server' || r.address === '@drwho:server'
      )
      expect(drwhoResults.length).toBe(1)
      expect(response.matches.length).toBe(1)
      expect(response.inactive_matches.length).toBe(0)
    })
  })

  describe('User enrichment', () => {
    it('should enrich users with UserInfoService data', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      const allResults = [...response.matches, ...response.inactive_matches]
      expect(allResults.length).toBeGreaterThan(0)

      const user = allResults[0]
      expect(user).toHaveProperty('uid')
      expect(user).toHaveProperty('address')
      expect(user).toHaveProperty('display_name')
      expect(user).toHaveProperty('avatar_url')
      expect(user).toHaveProperty('first_name')
      expect(user).toHaveProperty('last_name')
      expect(user).toHaveProperty('emails')
      expect(user).toHaveProperty('phones')
      expect(user).toHaveProperty('language')
      expect(user).toHaveProperty('timezone')
    })

    it('should include deprecated fields for backward compatibility', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      const allResults = [...response.matches, ...response.inactive_matches]
      const user = allResults[0]

      expect(user).toHaveProperty('displayName')
      expect(user).toHaveProperty('cn')
      expect(user).toHaveProperty('givenName')
      expect(user).toHaveProperty('givenname')
      expect(user).toHaveProperty('mail')
      expect(user).toHaveProperty('mobile')
    })

    it('should handle UserInfoService errors gracefully', async () => {
      mockUserInfoGet.mockRejectedValueOnce(new Error('UserInfo fetch failed'))

      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
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

    it('should skip users when UserInfoService returns null', async () => {
      mockUserInfoGet.mockResolvedValueOnce(null)

      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      const allResults = [...response.matches, ...response.inactive_matches]

      // Users without user info are skipped from results
      expect(allResults.length).toBe(0)
    })

    it('should handle enrichment errors gracefully', async () => {
      const UserInfoServiceMock =
        require('../../../user-info-api/services').default
      UserInfoServiceMock.mockImplementationOnce(function () {
        return {
          get: jest.fn().mockRejectedValue(new Error('Enrichment failed'))
        }
      })

      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
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

  describe('Concurrent execution', () => {
    it('should continue if one data source fails', async () => {
      const mixedServer = {
        ...idServerMock,
        matrixDb: {
          db: {
            match: jest.fn().mockRejectedValue(new Error('MatrixDb failed'))
          }
        },
        userDB: {
          match: jest.fn().mockResolvedValue([{ uid: 'success' }])
        }
      }

      const searchFn = await _search(mixedServer as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'test',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      // Should still have results from userDB
      expect(
        response.matches.length + response.inactive_matches.length
      ).toBeGreaterThan(0)
    })
  })

  describe('Pagination', () => {
    it('should apply offset and limit across all results', async () => {
      const serverWithManyUsers = {
        ...idServerMock,
        matrixDb: {
          db: {
            match: jest
              .fn()
              .mockResolvedValue([
                { user_id: '@user1:server' },
                { user_id: '@user2:server' },
                { user_id: '@user3:server' }
              ])
          }
        },
        userDB: {
          match: jest
            .fn()
            .mockResolvedValue([
              { uid: 'user1' },
              { uid: 'user2' },
              { uid: 'user3' },
              { uid: 'user4' },
              { uid: 'user5' }
            ])
        }
      }

      const searchFn = await _search(serverWithManyUsers as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'user',
        owner: '@admin:server',
        offset: 1,
        limit: 2
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      const totalReturned =
        response.matches.length + response.inactive_matches.length

      // Should return exactly 2 results (limit)
      expect(totalReturned).toBe(2)
    })

    it('should only enrich paginated subset of users', async () => {
      mockUserInfoGet.mockClear()

      const serverWithManyUsers = {
        ...idServerMock,
        matrixDb: {
          db: {
            match: jest
              .fn()
              .mockResolvedValue([
                { user_id: '@user1:server' },
                { user_id: '@user2:server' },
                { user_id: '@user3:server' },
                { user_id: '@user4:server' },
                { user_id: '@user5:server' }
              ])
          }
        },
        userDB: {
          match: jest.fn().mockResolvedValue([])
        }
      }

      const searchFn = await _search(serverWithManyUsers as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'user',
        owner: '@admin:server',
        offset: 0,
        limit: 2
      }

      await searchFn(resMock, dataMock)

      // Should only call UserInfoService for 2 users (the paginated subset)
      // not all 5 users
      expect(mockUserInfoGet).toHaveBeenCalledTimes(2)
    })

    it('should handle offset beyond total results', async () => {
      const searchFn = await _search(idServerMock as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server',
        offset: 100,
        limit: 10
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      expect(response.matches).toEqual([])
      expect(response.inactive_matches).toEqual([])
    })

    it('should use default limit when not specified', async () => {
      const serverWithManyUsers = {
        ...idServerMock,
        matrixDb: {
          db: {
            match: jest.fn().mockResolvedValue(
              Array.from({ length: 50 }, (_, i) => ({
                user_id: `@user${i}:server`
              }))
            )
          }
        },
        userDB: {
          match: jest.fn().mockResolvedValue([])
        }
      }

      const searchFn = await _search(serverWithManyUsers as any, logger as any)
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'user',
        owner: '@admin:server'
        // No limit specified
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      const totalReturned =
        response.matches.length + response.inactive_matches.length

      // Should return default limit of 30
      expect(totalReturned).toBe(30)
    })
  })
})
