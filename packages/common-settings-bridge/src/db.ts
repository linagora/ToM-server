/**
 * Database layer for common-settings-bridge
 * Uses @twake/db for lightweight database operations
 */

import { type TwakeLogger } from '@twake/logger'
import Database, { type DatabaseConfig as DbConfig } from '@twake/db'
import {
  type DatabaseConfig,
  type UserSettings,
  type SettingsPayload,
  type BridgeCollections
} from './types'
import { DatabaseOperationError } from './errors'

/**
 * Table schema for usersettings
 */
const TABLES: Record<BridgeCollections, string> = {
  usersettings: 'matrix_id varchar(64) PRIMARY KEY, settings jsonb, version int'
}

/**
 * Database wrapper for common-settings-bridge
 */
export class SettingsDatabase {
  private readonly db: Database<BridgeCollections>
  private readonly logger: TwakeLogger
  private _ready: Promise<void>

  constructor(config: DatabaseConfig, logger: TwakeLogger) {
    this.logger = logger

    // Build config compatible with @twake/db DatabaseConfig
    const dbConfig: DbConfig = {
      database_engine: config.engine,
      database_host: config.host,
      database_name: config.name,
      database_user: config.user,
      database_password: config.password,
      database_ssl: config.ssl ?? false,
      database_vacuum_delay: 3600
    }

    // Initialize database with custom tables
    this.db = new Database<BridgeCollections>(dbConfig, logger, TABLES)
    this._ready = this.db.ready
  }

  /**
   * Wait for database to be ready
   */
  get ready(): Promise<void> {
    return this._ready
  }

  /**
   * Get user settings by matrix_id
   * @param matrixId The user's Matrix ID
   * @returns User settings or null if not found
   */
  async getUserSettings(matrixId: string): Promise<UserSettings | null> {
    try {
      const results = await this.db.get('usersettings', ['*'], {
        matrix_id: matrixId
      })

      if (!Array.isArray(results) || results.length === 0) {
        return null
      }

      const row = results[0] as Record<string, unknown>
      return {
        matrix_id: row.matrix_id as string,
        settings:
          typeof row.settings === 'string'
            ? JSON.parse(row.settings)
            : (row.settings as SettingsPayload),
        version: row.version as number
      }
    } catch (error: any) {
      this.logger.error('[SettingsDatabase] Failed to get user settings', {
        matrixId,
        error: error.message
      })
      throw new DatabaseOperationError('get', error.message)
    }
  }

  /**
   * Insert new user settings
   * @param matrixId The user's Matrix ID
   * @param settings The settings payload
   * @param version The settings version
   */
  async insertUserSettings(
    matrixId: string,
    settings: SettingsPayload,
    version: number
  ): Promise<void> {
    try {
      await this.db.insert('usersettings', {
        matrix_id: matrixId,
        settings: JSON.stringify(settings),
        version
      })
      this.logger.info('[SettingsDatabase] Inserted user settings', {
        matrixId
      })
    } catch (error: any) {
      this.logger.error('[SettingsDatabase] Failed to insert user settings', {
        matrixId,
        error: error.message
      })
      throw new DatabaseOperationError('insert', error.message)
    }
  }

  /**
   * Update existing user settings
   * @param matrixId The user's Matrix ID
   * @param settings The settings payload
   * @param version The settings version
   */
  async updateUserSettings(
    matrixId: string,
    settings: SettingsPayload,
    version: number
  ): Promise<void> {
    try {
      await this.db.update(
        'usersettings',
        {
          settings: JSON.stringify(settings),
          version
        },
        'matrix_id',
        matrixId
      )
      this.logger.info('[SettingsDatabase] Updated user settings', { matrixId })
    } catch (error: any) {
      this.logger.error('[SettingsDatabase] Failed to update user settings', {
        matrixId,
        error: error.message
      })
      throw new DatabaseOperationError('update', error.message)
    }
  }

  /**
   * Get or create user settings
   * @param matrixId The user's Matrix ID
   * @param settings The settings payload (for creation)
   * @param version The settings version (for creation)
   * @returns Object with userSettings and created flag
   */
  async getOrCreateUserSettings(
    matrixId: string,
    settings: SettingsPayload,
    version: number
  ): Promise<{ userSettings: UserSettings; created: boolean }> {
    const existing = await this.getUserSettings(matrixId)

    if (existing !== null) {
      return { userSettings: existing, created: false }
    }

    await this.insertUserSettings(matrixId, settings, version)
    return {
      userSettings: { matrix_id: matrixId, settings, version },
      created: true
    }
  }

  /**
   * Check if settings have changed
   * @param existing Existing user settings
   * @param newSettings New settings payload
   * @returns Object indicating what changed
   */
  detectChanges(
    existing: UserSettings,
    newSettings: SettingsPayload
  ): { displayNameChanged: boolean; avatarChanged: boolean } {
    const oldSettings = existing.settings
    return {
      displayNameChanged: oldSettings.display_name !== newSettings.display_name,
      avatarChanged: oldSettings.avatar !== newSettings.avatar
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      this.db.close()
      this.logger.info('[SettingsDatabase] Database connection closed')
    } catch (error: any) {
      this.logger.warn('[SettingsDatabase] Error closing database', {
        error: error.message
      })
    }
  }
}
