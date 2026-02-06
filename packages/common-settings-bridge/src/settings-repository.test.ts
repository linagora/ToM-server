import { ISettingsPayload, UserSettingsTableName } from './types'

// Mock the dependencies at module load time
jest.mock('@twake/db', () => ({
  Database: jest.fn()
}))

jest.mock('matrix-appservice-bridge', () => {
  const mockLoggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
  const MockLogger = jest.fn(() => mockLoggerInstance)
  ;(MockLogger as any).configure = jest.fn()

  return {
    Logger: MockLogger
  }
})

import { SettingsRepository } from './settings-repository'

// Type-only imports to avoid runtime module resolution issues in tests
type Database<T> = {
  get: jest.Mock
  insert: jest.Mock
  update: jest.Mock
  close: jest.Mock
}

type Logger = {
  debug: jest.Mock
  info: jest.Mock
  warn: jest.Mock
  error: jest.Mock
}

describe('SettingsRepository', () => {
  let repository: SettingsRepository
  let mockDb: Database<UserSettingsTableName>
  let mockLogger: Logger

  const createMockLogger = (): Logger => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })

  const createMockDatabase = (): Database<UserSettingsTableName> => ({
    get: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    close: jest.fn()
  })

  const createTestPayload = (
    overrides: Partial<ISettingsPayload> = {}
  ): ISettingsPayload => ({
    matrix_id: '@user:example.com',
    display_name: 'Test User',
    avatar: 'mxc://example.com/avatar123',
    email: 'test@example.com',
    phone: '+1234567890',
    language: 'en',
    timezone: 'UTC',
    first_name: 'Test',
    last_name: 'User',
    ...overrides
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockDb = createMockDatabase()
    mockLogger = createMockLogger()
    repository = new SettingsRepository(mockDb as any, mockLogger as any)
  })

  describe('getUserSettings', () => {
    it('should get existing user settings', async () => {
      const payload = createTestPayload()
      const dbRow = {
        matrix_id: '@user:example.com',
        settings: payload, // jsonb returns as object, not string
        version: 1,
        timestamp: 1234567890,
        request_id: 'req-123'
      }

      mockDb.get.mockResolvedValue([dbRow])

      const result = await repository.getUserSettings('@user:example.com')

      expect(mockDb.get).toHaveBeenCalledWith(
        'usersettings',
        ['matrix_id', 'settings', 'version', 'timestamp', 'request_id'],
        { matrix_id: '@user:example.com' }
      )

      expect(result).toEqual({
        nickname: '@user:example.com',
        payload,
        version: 1,
        timestamp: 1234567890,
        request_id: 'req-123'
      })

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Looking up user settings for @user:example.com'
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found existing settings for @user:example.com')
      )
    })

    it('should return null when user does not exist', async () => {
      mockDb.get.mockResolvedValue([])

      const result = await repository.getUserSettings(
        '@nonexistent:example.com'
      )

      expect(result).toBeNull()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No existing settings found for @nonexistent:example.com'
      )
    })

    it('should return null when settings JSON is corrupted', async () => {
      const dbRow = {
        matrix_id: '@user:example.com',
        settings: 'invalid json {',
        version: 1,
        timestamp: 1234567890,
        request_id: 'req-123'
      }

      mockDb.get.mockResolvedValue([dbRow])

      const result = await repository.getUserSettings('@user:example.com')

      expect(result).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to parse settings payload from database'
        )
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Settings for @user:example.com in database are corrupted, treating as new user'
        )
      )
    })

    it('should throw error when database query fails', async () => {
      const dbError = new Error('Database connection failed')
      mockDb.get.mockRejectedValue(dbError)

      await expect(
        repository.getUserSettings('@user:example.com')
      ).rejects.toThrow('Database connection failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error retrieving settings for @user:example.com: Database connection failed'
        )
      )
    })
  })

  describe('saveSettings', () => {
    const userId = '@user:example.com'
    const payload = createTestPayload()
    const version = 1
    const timestamp = 1234567890
    const requestId = 'req-123'

    it('should insert new settings when isNewUser is true', async () => {
      mockDb.insert.mockResolvedValue(undefined)

      await repository.saveSettings(
        userId,
        payload,
        version,
        timestamp,
        requestId,
        true
      )

      expect(mockDb.insert).toHaveBeenCalledWith('usersettings', {
        matrix_id: userId,
        settings: JSON.stringify(payload),
        version,
        timestamp,
        request_id: requestId
      })

      expect(mockDb.update).not.toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Inserting new cache entry for ${userId}`
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Successfully inserted cache entry for ${userId}`
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Cache updated for ${userId}`)
      )
    })

    it('should update existing settings when isNewUser is false', async () => {
      mockDb.update.mockResolvedValue(undefined)

      await repository.saveSettings(
        userId,
        payload,
        version,
        timestamp,
        requestId,
        false
      )

      expect(mockDb.update).toHaveBeenCalledWith(
        'usersettings',
        {
          matrix_id: userId,
          settings: JSON.stringify(payload),
          version,
          timestamp,
          request_id: requestId
        },
        'matrix_id',
        userId
      )

      expect(mockDb.insert).not.toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Updating cache entry for ${userId}`
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Successfully updated cache entry for ${userId}`
      )
    })

    it('should throw error when insert fails with non-duplicate error', async () => {
      const insertError = new Error('Database connection lost')
      mockDb.insert.mockRejectedValue(insertError)

      await expect(
        repository.saveSettings(
          userId,
          payload,
          version,
          timestamp,
          requestId,
          true
        )
      ).rejects.toThrow('Database connection lost')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Failed to insert cache entry for ${userId}: Database connection lost`
        )
      )
    })

    it('should fallback to update when insert fails with duplicate key error', async () => {
      const duplicateError = new Error(
        'duplicate key value violates unique constraint'
      )
      mockDb.insert.mockRejectedValue(duplicateError)
      mockDb.update.mockResolvedValue(undefined)

      await repository.saveSettings(
        userId,
        payload,
        version,
        timestamp,
        requestId,
        true
      )

      expect(mockDb.insert).toHaveBeenCalledWith('usersettings', {
        matrix_id: userId,
        settings: JSON.stringify(payload),
        version,
        timestamp,
        request_id: requestId
      })
      expect(mockDb.update).toHaveBeenCalledWith(
        'usersettings',
        {
          matrix_id: userId,
          settings: JSON.stringify(payload),
          version,
          timestamp,
          request_id: requestId
        },
        'matrix_id',
        userId
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate key on insert')
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('after insert race')
      )
    })

    it('should fallback to update when insert fails with PostgreSQL unique violation code', async () => {
      const duplicateError: any = new Error('unique constraint violation')
      duplicateError.code = '23505'
      mockDb.insert.mockRejectedValue(duplicateError)
      mockDb.update.mockResolvedValue(undefined)

      await repository.saveSettings(
        userId,
        payload,
        version,
        timestamp,
        requestId,
        true
      )

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('concurrent insert detected')
      )
    })

    it('should throw error when update fails', async () => {
      const updateError = new Error('Update failed')
      mockDb.update.mockRejectedValue(updateError)

      await expect(
        repository.saveSettings(
          userId,
          payload,
          version,
          timestamp,
          requestId,
          false
        )
      ).rejects.toThrow('Update failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Failed to update cache entry for ${userId}: Update failed`
        )
      )
    })

    it('should serialize payload as JSON string', async () => {
      mockDb.insert.mockResolvedValue(undefined)

      const complexPayload = createTestPayload({
        display_name: 'User with "quotes" and special chars: \n\t'
      })

      await repository.saveSettings(
        userId,
        complexPayload,
        version,
        timestamp,
        requestId,
        true
      )

      expect(mockDb.insert).toHaveBeenCalledWith('usersettings', {
        matrix_id: userId,
        settings: JSON.stringify(complexPayload),
        version,
        timestamp,
        request_id: requestId
      })
    })
  })
})
