import {
  sendError,
  validateFieldsAndScope,
  filterContacts,
  buildContactMap,
  processUserAndMatrixDbRows,
  SearchFields,
  MappedContact,
  UserDbRow,
  MatrixDbRow,
  Query
} from './_search' // Adjust the path if necessary
import { type Contact } from '../../addressbook-api/types'

// Mock external dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn()
} as any // Cast to any to bypass strict type checking for mocks

// Mock the 'send' and 'errMsg' functions directly
jest.mock('@twake/utils', () => ({
  send: jest.fn(),
  errMsg: jest.fn((code, message) => ({ errcode: code, error: message })),
  toMatrixId: jest.fn((uid, serverName) => `@${uid}:${serverName}`)
}))

// Import the mocked functions
import { send, errMsg, toMatrixId } from '@twake/utils'

const mockResponse = {
  status: jest.fn().mockReturnThis(),
  send: jest.fn() // This mock is no longer directly used by sendError due to mocking @twake/utils.send
} as any

// Mock TwakeIdentityServer and its internal services/configs
const mockIdServer = {
  conf: {
    server_name: 'test.server',
    additional_features: true
  },
  db: {}, // Mock database instance if needed by AddressbookService
  userDB: {
    match: jest.fn(),
    getAll: jest.fn()
  },
  matrixDb: {
    get: jest.fn()
  }
} as any

// Mock AddressbookService
jest.mock('../../addressbook-api/services', () => ({
  AddressbookService: jest.fn(() => ({
    list: jest.fn()
  }))
}))

// Helper to reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
  // Reset mock implementations if they were changed in tests
  ;(send as jest.Mock).mockClear()
  ;(errMsg as jest.Mock).mockClear()
  ;(toMatrixId as jest.Mock).mockClear()
  Object.values(mockLogger).forEach((mockFn) =>
    (mockFn as jest.Mock).mockClear()
  )
})

describe('sendError', () => {
  it('should call logger.error and send a 500 response', () => {
    const error = new Error('Test error')
    sendError(mockResponse, error, 'test_context', mockLogger)

    expect(mockLogger.error).toHaveBeenCalledWith('Autocompletion error', {
      message: 'Test error',
      context: 'test_context'
    })
    // Now expecting the mocked 'send' from @twake/utils to be called
    expect(send).toHaveBeenCalledWith(500, {
      errcode: 'unknown',
      error: 'Test error'
    })
  })

  it('should handle string errors and default context', () => {
    sendError(mockResponse, 'String error', undefined, mockLogger)

    expect(mockLogger.error).toHaveBeenCalledWith('Autocompletion error', {
      message: '"String error"',
      context: 'unknown'
    })
    // Now expecting the mocked 'send' from @twake/utils to be called
    expect(send).toHaveBeenCalledWith(500, {
      errcode: 'unknown',
      error: '"String error"'
    })
  })
})

describe('validateFieldsAndScope', () => {
  it('should return true for valid fields and scope', () => {
    const fields = ['uid', 'displayName']
    const scope = ['mail']
    expect(validateFieldsAndScope(fields, scope, mockLogger)).toBe(true)
    expect(mockLogger.warn).not.toHaveBeenCalled()
  })

  it('should return false and log warning for invalid fields', () => {
    const fields = ['uid', 'invalidField']
    const scope = ['mail']
    expect(validateFieldsAndScope(fields, scope, mockLogger)).toBe(false)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[_search] Invalid field detected.',
      { field: 'invalidField' }
    )
  })

  it('should return false and log warning for invalid scope', () => {
    const fields = ['uid']
    const scope = ['invalidScope']
    expect(validateFieldsAndScope(fields, scope, mockLogger)).toBe(false)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[_search] Invalid scope value detected.',
      { scopeValue: 'invalidScope' }
    )
  })

  it('should handle empty fields and scope', () => {
    expect(validateFieldsAndScope([], [], mockLogger)).toBe(true)
  })
})

describe('filterContacts', () => {
  // Updated mock contacts to include all required properties for the Contact interface
  const contacts: Contact[] = [
    {
      id: '1',
      mxid: '@user1:test.com',
      display_name: 'User One',
      active: true,
      addressbook_id: 'ab1'
    },
    {
      id: '2',
      mxid: '@user2:test.com',
      display_name: 'Another User',
      active: true,
      addressbook_id: 'ab1'
    },
    {
      id: '3',
      mxid: '@bob:test.com',
      display_name: 'Bob Smith',
      active: true,
      addressbook_id: 'ab2'
    },
    {
      id: '4',
      mxid: '@alice:test.com',
      display_name: 'Alice Johnson',
      active: true,
      addressbook_id: 'ab2'
    }
  ]

  it('should return all contacts if search value is empty', () => {
    const filtered = filterContacts(contacts, '', ['cn'], mockLogger)
    expect(filtered).toEqual(contacts)
  })

  it('should filter by display_name (cn/displayName)', () => {
    const filtered = filterContacts(contacts, 'user', ['cn'], mockLogger)
    expect(filtered).toEqual([
      {
        id: '1',
        mxid: '@user1:test.com',
        display_name: 'User One',
        active: true,
        addressbook_id: 'ab1'
      },
      {
        id: '2',
        mxid: '@user2:test.com',
        display_name: 'Another User',
        active: true,
        addressbook_id: 'ab1'
      }
    ])
  })

  it('should filter by uid (from mxid)', () => {
    const filtered = filterContacts(contacts, 'alice', ['uid'], mockLogger)
    expect(filtered).toEqual([
      {
        id: '4',
        mxid: '@alice:test.com',
        display_name: 'Alice Johnson',
        active: true,
        addressbook_id: 'ab2'
      }
    ])
  })

  it('should filter by mxid (mail/mobile)', () => {
    const filtered = filterContacts(contacts, 'user1', ['mail'], mockLogger)
    expect(filtered).toEqual([
      {
        id: '1',
        mxid: '@user1:test.com',
        display_name: 'User One',
        active: true,
        addressbook_id: 'ab1'
      }
    ])
  })

  it('should be case-insensitive', () => {
    const filtered = filterContacts(
      contacts,
      'bob',
      ['displayName'],
      mockLogger
    )
    expect(filtered).toEqual([
      {
        id: '3',
        mxid: '@bob:test.com',
        display_name: 'Bob Smith',
        active: true,
        addressbook_id: 'ab2'
      }
    ])
  })

  it('should return empty array if no matches', () => {
    const filtered = filterContacts(contacts, 'nomatch', ['cn'], mockLogger)
    expect(filtered).toEqual([])
  })

  it('should handle multiple scope fields', () => {
    const filtered = filterContacts(contacts, 'one', ['cn', 'uid'], mockLogger)
    expect(filtered).toEqual([
      {
        id: '1',
        mxid: '@user1:test.com',
        display_name: 'User One',
        active: true,
        addressbook_id: 'ab1'
      }
    ])
  })
})

describe('buildContactMap', () => {
  // Updated mock contacts to include all required properties for the Contact interface
  const contacts: Contact[] = [
    {
      id: '1',
      mxid: '@user1:test.com',
      display_name: 'User One',
      active: true,
      addressbook_id: 'ab1'
    },
    {
      id: '2',
      mxid: '@user2:test.com',
      display_name: 'Another User',
      active: true,
      addressbook_id: 'ab1'
    },
    {
      id: 'invalid',
      mxid: 'invalid-mxid',
      display_name: 'Invalid User',
      active: false,
      addressbook_id: 'ab3'
    }, // Invalid MXID format
    {
      id: 'empty',
      mxid: '@empty:test.com',
      display_name: '',
      active: true,
      addressbook_id: 'ab4'
    } // Empty display name
  ]

  it('should build a map of contacts keyed by UID, skipping invalid MXIDs', () => {
    const contactMap = buildContactMap(contacts, mockLogger)
    expect(contactMap.size).toBe(3) // user1, user2, empty (invalid-mxid is skipped)
    expect(contactMap.get('user1')).toEqual({
      uid: 'user1',
      cn: 'User One',
      address: '@user1:test.com'
    })
    expect(contactMap.get('user2')).toEqual({
      uid: 'user2',
      cn: 'Another User',
      address: '@user2:test.com'
    })
    expect(contactMap.get('empty')).toEqual({
      uid: 'empty',
      cn: '',
      address: '@empty:test.com'
    })
    expect(contactMap.has('invalid-mxid')).toBe(false) // Ensure it's not mapped
  })

  it('should log a warning for contacts with invalid UIDs', () => {
    buildContactMap(contacts, mockLogger)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[_search] Skipping contact due to invalid UID.',
      { contactMxid: 'invalid-mxid' }
    )
  })
})

describe('processUserAndMatrixDbRows', () => {
  const mockQueryData: Query = {
    scope: ['uid'],
    limit: 2,
    offset: 0
  }

  const initialContactMap = new Map<string, MappedContact>([
    [
      'user1',
      { uid: 'user1', cn: 'User One From Map', address: '@user1:test.com' }
    ],
    [
      'user3',
      { uid: 'user3', cn: 'User Three From Map', address: '@user3:test.com' }
    ]
  ])

  const userDbRows: UserDbRow[] = [
    { uid: 'user1', mail: 'user1@example.com' }, // In map, active
    { uid: 'user2', mail: 'user2@example.com' }, // Not in map, active
    { uid: 'user3', mail: 'user3@example.com' }, // In map, inactive
    { uid: 'user4', mail: 'user4@example.com' }, // Not in map, inactive
    { uid: 'user5', mail: 'user5@example.com' }, // Beyond limit
    { uid: 'invalid_test_uid_1' }, // Valid UID, but will be filtered by `validRows` if empty string
    { uid: '' } // Invalid row, but has uid property
  ]

  const matrixDbRows: MatrixDbRow[] = [
    { name: '@user1:test.server' },
    { name: '@user2:test.server' }
  ]

  beforeEach(() => {
    mockIdServer.userDB.getAll.mockResolvedValue(userDbRows)
    mockIdServer.matrixDb.get.mockResolvedValue(matrixDbRows)
    ;(toMatrixId as jest.Mock).mockImplementation(
      (uid, serverName) => `@${uid}:${serverName}`
    )
  })

  it('should process user and matrix rows correctly, categorizing matches', async () => {
    const { matches, inactive_matches } = await processUserAndMatrixDbRows(
      userDbRows,
      mockQueryData,
      initialContactMap,
      mockIdServer,
      mockLogger
    )

    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[_search] Applying pagination to userDB rows.',
      expect.any(Object)
    )
    // Expect 2 rows after slicing due to limit: 2
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[_search] UserDB rows after slicing.',
      { numberOfUserRowsAfterSlice: 2 }
    )

    // Expect matrixDb.get to be called with UIDs from paginatedRows (user1, user2)
    expect(mockIdServer.matrixDb.get).toHaveBeenCalledWith('users', ['*'], {
      name: ['@user1:test.server', '@user2:test.server']
    })

    // The final matches should include active users from paginated rows AND remaining from initialContactMap
    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uid: 'user1',
          cn: 'User One From Map',
          address: '@user1:test.server'
        }),
        expect.objectContaining({
          uid: 'user2',
          mail: 'user2@example.com',
          address: '@user2:test.server'
        })
      ])
    )
    expect(matches.length).toBe(2) // user1, user2

    expect(inactive_matches).toEqual([]) // No inactive matches from the paginated set
    expect(inactive_matches.length).toBe(0)

    // Ensure the original initialContactMap is not mutated
    expect(initialContactMap.size).toBe(2)
    expect(initialContactMap.has('user1')).toBe(true)
    expect(initialContactMap.has('user3')).toBe(true)
  })

  it('should handle empty userDbRows', async () => {
    mockIdServer.userDB.getAll.mockResolvedValue([])
    const { matches, inactive_matches } = await processUserAndMatrixDbRows(
      [],
      mockQueryData,
      initialContactMap,
      mockIdServer,
      mockLogger
    )
    expect(matches).toEqual(Array.from(initialContactMap.values())) // Only contacts from initial map remain
    expect(inactive_matches).toEqual([])
    // Expect matrixDb.get to be called with an empty name array, as per current implementation
    expect(mockIdServer.matrixDb.get).toHaveBeenCalledWith('users', ['*'], {
      name: []
    })
  })

  it('should throw error if matrixDb query fails', async () => {
    mockIdServer.matrixDb.get.mockRejectedValue(new Error('Matrix DB error'))

    await expect(
      processUserAndMatrixDbRows(
        userDbRows,
        mockQueryData,
        initialContactMap,
        mockIdServer,
        mockLogger
      )
    ).rejects.toThrow('matrixDb_query_error: Matrix DB error')

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[_search] Error during matrixDb query.',
      { error: expect.any(Error) }
    )
  })

  it('should log warning for invalid userDbRow elements', async () => {
    const invalidUserDbRows = [
      { uid: 'valid' },
      { uid: 'invalid_test_uid_1' },
      { uid: '' } // This will trigger the "Following element from userDB is invalid" warning
    ]
    mockIdServer.userDB.getAll.mockResolvedValue(invalidUserDbRows)
    mockIdServer.matrixDb.get.mockResolvedValue([]) // Mock matrixDb to return empty for simplicity

    await processUserAndMatrixDbRows(
      invalidUserDbRows as UserDbRow[],
      mockQueryData,
      new Map(),
      mockIdServer,
      mockLogger
    )

    // Expecting two specific warn calls
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[_search] Following element from userDB is invalid: {"uid":""}'
    )
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[_search] Invalid elements found after fetching user registry, PLEASE VERIFY YOUR LDAP_FILTER!'
    )
    expect(mockLogger.warn).toHaveBeenCalledTimes(2) // Verify total calls
  })

  it('should correctly apply pagination', async () => {
    const paginatedUserDbRows: UserDbRow[] = [
      { uid: 'user_p1', mail: 'user_p1@example.com' },
      { uid: 'user_p2', mail: 'user_p2@example.com' },
      { uid: 'user_p3', mail: 'user_p3@example.com' },
      { uid: 'user_p4', mail: 'user_p4@example.com' }
    ]
    const queryDataWithPagination: Query = {
      scope: ['uid'],
      limit: 2,
      offset: 1 // Start from the second element
    }
    mockIdServer.userDB.getAll.mockResolvedValue(paginatedUserDbRows)
    mockIdServer.matrixDb.get.mockResolvedValue([]) // No active users for simplicity

    const { matches, inactive_matches } = await processUserAndMatrixDbRows(
      paginatedUserDbRows,
      queryDataWithPagination,
      new Map(),
      mockIdServer,
      mockLogger
    )

    // Expect only user_p2 and user_p3 to be processed from paginated rows
    expect(inactive_matches.length).toBe(2)
    expect(inactive_matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uid: 'user_p2' }),
        expect.objectContaining({ uid: 'user_p3' })
      ])
    )
    expect(matches).toEqual([])
  })
})
