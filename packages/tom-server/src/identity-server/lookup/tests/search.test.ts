import { _search } from '../_search.ts'
import { send, isMatrixId } from '@twake-chat/utils'

// Mock @twake-chat/utils
jest.mock('@twake-chat/utils', () => ({
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

// Mock service functions
const mockAddressbookList = jest.fn()
const mockUserInfoGetBatch = jest.fn()

// Helper to create user info from mxid
const createUserInfo = (mxid: string) => {
  const uid = mxid.includes('@') ? mxid.replace(/^@(.*?):.*/, '$1') : mxid
  return {
    uid: mxid,
    display_name: `Display ${uid}`,
    avatar_url: `mxc://server/avatar_${uid}`,
    first_name: 'First',
    last_name: 'Last',
    sn: 'Last',
    emails: [`${uid}@example.com`],
    phones: ['1234567890'],
    language: 'en',
    timezone: 'UTC'
  }
}

// Create mock service instances
const createMockServices = () => ({
  addressbookService: {
    list: mockAddressbookList
  } as any,
  userInfoService: {
    getBatch: mockUserInfoGetBatch
  } as any
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

    // Default mock: addressbook returns empty
    mockAddressbookList.mockResolvedValue({ contacts: [] })

    // Default mock: getBatch returns a Map with user info for requested mxids
    mockUserInfoGetBatch.mockImplementation(
      async (mxids: string[], _viewer?: string) => {
        const result = new Map()
        for (const mxid of mxids) {
          result.set(mxid, createUserInfo(mxid))
        }
        return result
      }
    )
    ;(isMatrixId as jest.Mock).mockImplementation((id) => {
      if (!id || typeof id !== 'string') return false
      return /^@[^:]+:[^:]+$/.test(id)
    })
  })

  describe('Basic search functionality', () => {
    it('should return matches and inactive matches successfully', async () => {
      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        emptyServer as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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
      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: '',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      expect(send).toHaveBeenCalledWith(resMock, 200, {
        matches: [],
        inactive_matches: []
      })
    })

    it('should handle search without owner', async () => {
      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        serverWithLocalId as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        serverNoFeatures as any,
        logger as any,
        addressbookService,
        userInfoService
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'test',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      // matrixDb.match should not have been called
      expect(serverNoFeatures.matrixDb.db.match).not.toHaveBeenCalled()
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        serverWithFeatures as any,
        logger as any,
        addressbookService,
        userInfoService
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      expect(serverWithFeatures.matrixDb.db.match).toHaveBeenCalled()
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        brokenMatrixServer as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        serverNoFeatures as any,
        logger as any,
        addressbookService,
        userInfoService
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'test',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      // userDB.match should not be called when additional_features is disabled
      expect(serverNoFeatures.userDB.match).not.toHaveBeenCalled()
    })

    it('should handle userDB errors gracefully', async () => {
      const brokenUserServer = {
        ...idServerMock,
        userDB: {
          match: jest.fn().mockRejectedValue(new Error('UserDB error'))
        }
      }

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        brokenUserServer as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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
          { mxid: '@drwho:server', display_name: 'Dr Who' },
          { mxid: '@janedoe:server', display_name: 'Jane Doe' }
        ]
      })

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        emptyDbServer as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

    it('should not search addressbook without owner', async () => {
      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: ''
      }

      await searchFn(resMock, dataMock)

      expect(mockAddressbookList).not.toHaveBeenCalled()
    })
  })

  describe('Active vs Inactive user distinction', () => {
    it('should mark users found in matrixDb as active', async () => {
      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        serverWithInactiveUser as any,
        logger as any,
        addressbookService,
        userInfoService
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        serverWithDuplicates as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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
    it('should enrich users with UserInfoService.getBatch data', async () => {
      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      expect(mockUserInfoGetBatch).toHaveBeenCalled()

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
      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

    it('should handle UserInfoService.getBatch errors gracefully', async () => {
      mockUserInfoGetBatch.mockRejectedValueOnce(
        new Error('UserInfo fetch failed')
      )

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      expect(send).toHaveBeenCalledWith(resMock, 200, {
        matches: [],
        inactive_matches: []
      })
    })

    it('should skip users when UserInfoService returns empty Map', async () => {
      mockUserInfoGetBatch.mockResolvedValueOnce(new Map())

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'drwho',
        owner: '@user123:server'
      }

      await searchFn(resMock, dataMock)

      const response = (send as jest.Mock).mock.calls[0][2]
      expect(response.matches).toEqual([])
      expect(response.inactive_matches).toEqual([])
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        mixedServer as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        serverWithManyUsers as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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
      mockUserInfoGetBatch.mockClear()

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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        serverWithManyUsers as any,
        logger as any,
        addressbookService,
        userInfoService
      )
      const resMock = {} as any
      const dataMock = {
        scope: ['uid'],
        val: 'user',
        owner: '@admin:server',
        offset: 0,
        limit: 2
      }

      await searchFn(resMock, dataMock)

      // getBatch is called twice (once for active, once for inactive)
      // but each call should only have 2 users max (the paginated subset)
      const calls = mockUserInfoGetBatch.mock.calls
      const totalMxids = calls.reduce(
        (sum, call) => sum + (call[0]?.length || 0),
        0
      )
      expect(totalMxids).toBe(2)
    })

    it('should handle offset beyond total results', async () => {
      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        idServerMock as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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

      const { addressbookService, userInfoService } = createMockServices()
      const searchFn = await _search(
        serverWithManyUsers as any,
        logger as any,
        addressbookService,
        userInfoService
      )
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
