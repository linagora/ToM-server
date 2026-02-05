import { Database } from '@twake/db'
import { Logger } from 'matrix-appservice-bridge'
import { UserSettings, UserSettingsTableName, SettingsPayload } from './types'

/**
 * Repository for managing user settings persistence in the database.
 * Handles all database operations for storing and retrieving user settings,
 * including JSON serialization/deserialization and error handling.
 */
export class SettingsRepository {
  readonly #db: Database<UserSettingsTableName>
  readonly #logger: Logger

  /**
   * Creates a new SettingsRepository instance.
   * @param db - Database instance for user settings operations
   * @param logger - Logger instance for diagnostic output
   */
  constructor(db: Database<UserSettingsTableName>, logger: Logger) {
    this.#db = db
    this.#logger = logger
  }

  /**
   * Retrieves existing user settings from the database.
   * Handles JSON parsing and returns null for missing or corrupted data.
   *
   * @param userId - The Matrix user ID to look up
   * @returns UserSettings object or null if user not found or data is corrupted
   * @throws Error if database query fails
   */
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    this.#logger.debug(`Looking up user settings for ${userId}`)

    try {
      const result = await this.#db.get(
        'usersettings',
        ['matrix_id', 'settings', 'version', 'timestamp', 'request_id'],
        { matrix_id: userId }
      )

      if (result.length === 0) {
        this.#logger.debug(`No existing settings found for ${userId}`)
        return null
      }

      const dbRow = result[0] as Record<string, unknown>
      const parsedSettings = this.#safeParsePayload(dbRow.settings as string)

      if (parsedSettings === null) {
        this.#logger.warn(
          `Settings for ${userId} in database are corrupted, treating as new user`
        )
        return null
      }

      this.#logger.debug(
        `Found existing settings for ${userId}: version=${dbRow.version}, timestamp=${dbRow.timestamp}, request_id=${dbRow.request_id}`
      )

      return {
        nickname: dbRow.matrix_id as string,
        payload: parsedSettings,
        version: dbRow.version as number,
        timestamp: dbRow.timestamp as number,
        request_id: dbRow.request_id as string
      }
    } catch (error) {
      this.#logger.error(
        `Error retrieving settings for ${userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      throw error
    }
  }

  /**
   * Saves user settings to the database.
   * Inserts a new row for new users or updates existing row for returning users.
   *
   * @param userId - The Matrix user ID
   * @param payload - The settings payload to persist
   * @param version - The version number of the settings
   * @param timestamp - The timestamp when settings were last modified
   * @param requestId - The unique request ID for idempotency tracking
   * @param isNewUser - Whether this is a new user (insert) or existing user (update)
   * @throws Error if database operation fails
   */
  async saveSettings(
    userId: string,
    payload: SettingsPayload,
    version: number,
    timestamp: number,
    requestId: string,
    isNewUser: boolean
  ): Promise<void> {
    const cacheData = {
      matrix_id: userId,
      settings: JSON.stringify(payload),
      version,
      timestamp,
      request_id: requestId
    }

    if (isNewUser) {
      this.#logger.debug(`Inserting new cache entry for ${userId}`)
      try {
        await this.#db.insert('usersettings', cacheData)
        this.#logger.debug(`Successfully inserted cache entry for ${userId}`)
      } catch (error) {
        // Handle TOCTOU race: another request may have inserted first
        const errorMsg =
          error instanceof Error ? error.message.toLowerCase() : ''
        const errorCode = (error as any)?.code
        const isDuplicateKey =
          errorMsg.includes('duplicate') ||
          errorMsg.includes('unique') ||
          errorMsg.includes('constraint') ||
          errorCode === '23505' // PostgreSQL unique violation

        if (isDuplicateKey) {
          this.#logger.debug(
            `Duplicate key on insert for ${userId}, falling back to update (concurrent insert detected)`
          )
          await this.#db.update('usersettings', cacheData, 'matrix_id', userId)
          this.#logger.debug(
            `Successfully updated cache entry for ${userId} (after insert race)`
          )
        } else {
          this.#logger.error(
            `Failed to insert cache entry for ${userId}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          )
          throw error
        }
      }
    } else {
      this.#logger.debug(`Updating cache entry for ${userId}`)
      try {
        await this.#db.update('usersettings', cacheData, 'matrix_id', userId)
        this.#logger.debug(`Successfully updated cache entry for ${userId}`)
      } catch (error) {
        this.#logger.error(
          `Failed to update cache entry for ${userId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
        throw error
      }
    }

    this.#logger.debug(
      `Cache updated for ${userId}: version=${version}, timestamp=${timestamp}, request_id=${requestId}`
    )
  }

  /**
   * Parses a settings payload from a JSON string.
   * Used when retrieving settings from the database.
   *
   * @param raw - The raw JSON string to parse
   * @returns The parsed SettingsPayload or null if parsing failed
   */
  #safeParsePayload(raw: string): SettingsPayload | null {
    try {
      return JSON.parse(raw) as SettingsPayload
    } catch (error) {
      this.#logger.warn(
        `Failed to parse settings payload from database: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      return null
    }
  }
}
