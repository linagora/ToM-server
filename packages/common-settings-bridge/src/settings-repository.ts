import { Database, DbGetResult } from '@twake/db'
import { Logger } from 'matrix-appservice-bridge'
import {
  UserSettingsTableName,
  ISettingsPayload,
  StoredUserSettings
} from './types'
import { formatTimestamp } from './bridge'

export class SettingsPayload implements ISettingsPayload {
  readonly #language?: string
  readonly #timezone?: string
  readonly #avatar?: string
  readonly #last_name?: string
  readonly #first_name?: string
  readonly #email?: string
  readonly #phone?: string
  readonly #matrix_id: string
  readonly #display_name?: string

  constructor(jsonString: string) {
    const data = SettingsPayload.#parseJSON(jsonString)

    /* Validate required field */
    if (typeof data.matrix_id !== 'string' || data.matrix_id.length === 0) {
      throw new Error('matrix_id is required and must be a non-empty string')
    }

    this.#matrix_id = data.matrix_id

    /* Parse optional string fields */
    this.#language = SettingsPayload.#validateOptionalString(
      data.language,
      'language'
    )
    this.#timezone = SettingsPayload.#validateOptionalString(
      data.timezone,
      'timezone'
    )
    this.#avatar = SettingsPayload.#validateOptionalString(
      data.avatar,
      'avatar'
    )
    this.#last_name = SettingsPayload.#validateOptionalString(
      data.last_name,
      'last_name'
    )
    this.#first_name = SettingsPayload.#validateOptionalString(
      data.first_name,
      'first_name'
    )
    this.#email = SettingsPayload.#validateOptionalString(data.email, 'email')
    this.#phone = SettingsPayload.#validateOptionalString(data.phone, 'phone')
    this.#display_name = SettingsPayload.#validateOptionalString(
      data.display_name,
      'display_name'
    )
  }

  /* Parse and validate JSON string */
  static #parseJSON(jsonString: string): Record<string, unknown> {
    let parsed: unknown

    try {
      parsed = JSON.parse(jsonString)
    } catch (err) {
      throw new Error(
        `Invalid JSON string: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Parsed JSON must be an object')
    }

    return parsed as Record<string, unknown>
  }

  /* Validate optional string field */
  static #validateOptionalString(
    value: unknown,
    fieldName: string
  ): string | undefined {
    if (value === undefined) {
      return undefined
    }

    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`)
    }

    return value
  }

  /* Getters for all fields */
  get language(): string | undefined {
    return this.#language
  }

  get timezone(): string | undefined {
    return this.#timezone
  }

  get avatar(): string | undefined {
    return this.#avatar
  }

  get last_name(): string | undefined {
    return this.#last_name
  }

  get first_name(): string | undefined {
    return this.#first_name
  }

  get email(): string | undefined {
    return this.#email
  }

  get phone(): string | undefined {
    return this.#phone
  }

  get matrix_id(): string {
    return this.#matrix_id
  }

  get display_name(): string | undefined {
    return this.#display_name
  }

  /* Create instance from plain object */
  static fromObject(obj: ISettingsPayload): ISettingsPayload {
    return new SettingsPayload(JSON.stringify(obj))
  }

  /* Serialize back to JSON */
  toJSON(): string {
    return JSON.stringify({
      matrix_id: this.#matrix_id,
      ...(this.#language && { language: this.#language }),
      ...(this.#timezone && { timezone: this.#timezone }),
      ...(this.#avatar && { avatar: this.#avatar }),
      ...(this.#last_name && { last_name: this.#last_name }),
      ...(this.#first_name && { first_name: this.#first_name }),
      ...(this.#email && { email: this.#email }),
      ...(this.#phone && { phone: this.#phone }),
      ...(this.#display_name && { display_name: this.#display_name })
    })
  }

  /* Get plain object representation */
  toObject(): ISettingsPayload {
    return {
      matrix_id: this.#matrix_id,
      ...(this.#language && { language: this.#language }),
      ...(this.#timezone && { timezone: this.#timezone }),
      ...(this.#avatar && { avatar: this.#avatar }),
      ...(this.#last_name && { last_name: this.#last_name }),
      ...(this.#first_name && { first_name: this.#first_name }),
      ...(this.#email && { email: this.#email }),
      ...(this.#phone && { phone: this.#phone }),
      ...(this.#display_name && { display_name: this.#display_name })
    }
  }
}

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
  async getUserSettings(userId: string): Promise<StoredUserSettings | null> {
    this.#logger.debug(`Looking up user settings for ${userId}`)

    try {
      const result: DbGetResult = await this.#db.get(
        'usersettings',
        ['matrix_id', 'settings', 'version', 'timestamp', 'request_id'],
        { matrix_id: userId }
      )

      if (result.length === 0) {
        this.#logger.debug(`No existing settings found for ${userId}`)
        return null
      }

      const dbRow: Record<string, unknown> = result[0]
      const settingsRaw =
        typeof dbRow.settings === 'string'
          ? dbRow.settings
          : JSON.stringify(dbRow.settings)
      const parsedSettings = this.#safeParsePayload(settingsRaw)

      if (parsedSettings === null) {
        this.#logger.warn(
          `Settings for ${userId} in database are corrupted, treating as new user`
        )
        return null
      }

      this.#logger.debug(
        `Found existing settings for ${userId}: version=${
          dbRow.version
        }, timestamp=${formatTimestamp(
          parseInt(dbRow.timestamp as string, 10)
        )}, request_id=${dbRow.request_id}`
      )

      return {
        nickname: dbRow.matrix_id as string,
        payload: parsedSettings,
        version: dbRow.version as number,
        timestamp: parseInt(dbRow.timestamp as string, 10),
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
    payload: ISettingsPayload,
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
   * Parses a settings payload from database result.
   * Handles both JSON strings (sqlite) and objects (PostgreSQL jsonb).
   *
   * @param raw - The raw value from database (string or object)
   * @returns The parsed ISettingsPayload or null if parsing failed
   */
  #safeParsePayload(raw: string): ISettingsPayload | null {
    try {
      this.#logger.debug(`Parsing settings payload from database: ${raw}`)
      return new SettingsPayload(raw).toObject()
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
