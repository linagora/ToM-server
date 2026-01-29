import {
  Bridge,
  Cli,
  AppServiceRegistration,
  Logger,
  Intent
} from 'matrix-appservice-bridge'
import type { ConsumeMessage, Channel } from 'amqplib'

import { AMQPConnector } from '@twake/amqp-connector'
import { Database } from '@twake/db'
import type * as logger from '@twake/logger'

import {
  SynapseAdminRetryMode,
  type BridgeConfig,
  type CommonSettingsMessage,
  type UserSettings,
  type UserSettingsTableName,
  type SettingsPayload
} from './types'
import { UserIdNotProvidedError, MessageParseError } from './errors'

Logger.configure({
  console:
    (process.env.LOG_LEVEL as
      | 'info'
      | 'debug'
      | 'warn'
      | 'error'
      | 'trace'
      | 'off'
      | undefined) || 'info'
})

/**
 * CommonSettingsBridge handles synchronization of user settings between
 * an external system (via AMQP messages) and Matrix user profiles.
 * It listens for settings change messages and updates Matrix display names
 * and avatars accordingly.
 */
class CommonSettingsBridge {
  readonly #config: BridgeConfig
  readonly #log: Logger
  #bridge!: Bridge
  #botIntent!: Intent
  #adminApis!: any
  #db!: Database<UserSettingsTableName>
  #connector!: AMQPConnector

  /**
   * Creates a new CommonSettingsBridge instance.
   * @param config - The bridge configuration containing homeserver, database, and RabbitMQ settings
   */
  constructor(config: BridgeConfig) {
    this.#log = new Logger('CommonSettingsBridge')
    this.#log.debug('Initializing CommonSettingsBridge instance')
    this.#config = config
    this.#initDatabase()
    this.#initAmqpConnector()
    this.#log.debug('CommonSettingsBridge instance created')
  }

  /**
   * Initializes the database connection with the user settings table schema.
   * The database stores Matrix user IDs mapped to their settings JSON, version number,
   * timestamp, and request_id for idempotency.
   */
  #initDatabase(): void {
    this.#log.debug('Initializing database connection...')

    const dbConfig = {
      database_engine: this.#config.database.engine,
      database_host: this.#config.database.host ?? 'localhost',
      database_name: this.#config.database.name,
      database_user: this.#config.database.user,
      database_password: this.#config.database.password,
      database_vacuum_delay: 3600
    }

    this.#log.debug(
      `Database config: engine=${dbConfig.database_engine}, host=${dbConfig.database_host}, name=${dbConfig.database_name}, user=${dbConfig.database_user}`
    )

    const consoleLogger = {
      error: (msg: string) => this.#log.error(`[DB] ${msg}`),
      warn: (msg: string) => this.#log.warn(`[DB] ${msg}`),
      info: (msg: string) => this.#log.info(`[DB] ${msg}`),
      debug: (msg: string) => this.#log.debug(`[DB] ${msg}`),
      silly: (msg: string) => this.#log.debug('[DB][SILLY]', msg),
      close: () => {}
    }

    const tables: Record<UserSettingsTableName, string> = {
      usersettings:
        'matrix_id varchar(64) PRIMARY KEY, settings jsonb, version int, timestamp bigint, request_id varchar(255)'
    }

    this.#db = new Database<UserSettingsTableName>(
      dbConfig,
      consoleLogger as any,
      tables
    )

    this.#log.debug('Database instance created')
  }

  /**
   * Initializes the AMQP connector with exchange, queue, and dead letter configuration.
   * Sets up the message handler for processing incoming settings change messages.
   */
  #initAmqpConnector(): void {
    this.#log.debug('Initializing AMQP connector...')

    const consoleLogger = {
      info: (msg: string) => this.#log.info(`[AMQP] ${msg}`),
      warn: (msg: string) => this.#log.warn(`[AMQP] ${msg}`),
      error: (msg: string) => this.#log.error(`[AMQP] ${msg}`),
      debug: (msg: string) => this.#log.debug(`[AMQP] ${msg}`),
      silly: (msg: string) => this.#log.debug('[AMQP][SILLY]', msg),
      close: () => {}
    }

    const rabbitConfig = this.#config.rabbitmq

    this.#log.debug(
      `RabbitMQ config: host=${rabbitConfig.host}, exchange=${rabbitConfig.exchange}, queue=${rabbitConfig.queue}, routingKey=${rabbitConfig.routingKey}`
    )

    this.#connector = new AMQPConnector(consoleLogger as logger.TwakeLogger)
      .withConfig(rabbitConfig)
      .withExchange(rabbitConfig.exchange, { durable: true })
      .withQueue(
        rabbitConfig.queue,
        {
          durable: true,
          deadLetterExchange: rabbitConfig.deadLetterExchange,
          deadLetterRoutingKey: rabbitConfig.deadLetterRoutingKey
        },
        rabbitConfig.routingKey
      )
      .onMessage(this.#handleMessage.bind(this))

    this.#log.debug('AMQP connector configured')
  }

  /**
   * Creates and configures the Matrix bridge instance.
   * The bridge is configured without an event handler since this service
   * only processes AMQP messages, not Matrix events.
   * @returns The configured Bridge instance
   */
  #initBridge(): Bridge {
    this.#log.debug('Initializing Matrix bridge...')
    this.#log.debug(
      `Bridge config: homeserverUrl=${this.#config.homeserverUrl}, domain=${
        this.#config.domain
      }, registration=${this.#config.registrationPath}`
    )

    return new Bridge({
      homeserverUrl: this.#config.homeserverUrl,
      domain: this.#config.domain,
      registration: this.#config.registrationPath,
      disableStores: true,
      controller: {
        onEvent: () => {},
        onLog: (text: string, isError: boolean) => {
          if (isError) {
            this.#log.error(`[Bridge] ${text}`)
          } else {
            this.#log.debug(`[Bridge] ${text}`)
          }
        }
      }
    })
  }

  /**
   * Formats a timestamp for logging purposes.
   * @param timestamp - Unix timestamp in milliseconds
   * @returns Human-readable timestamp string
   */
  #formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString()
  }

  /**
   * Handles incoming AMQP messages containing user settings changes.
   * Implements idempotency checking and version-based ordering.
   * @param msg - The AMQP message containing settings data
   * @param channel - The AMQP channel for acknowledgment
   */
  async #handleMessage(msg: ConsumeMessage, channel: Channel): Promise<void> {
    this.#log.debug('Received AMQP message')

    const rawContent = msg.content.toString()
    this.#log.debug(`Message content length: ${rawContent.length} bytes`)

    const message = this.#safeParseMessage(rawContent)

    if (message === null) {
      this.#log.error('Failed to parse message content')
      this.#log.debug(`Raw message content: ${rawContent.substring(0, 200)}...`)
      throw new MessageParseError()
    }

    // Validate required fields
    if (!message.request_id) {
      this.#log.error('Message missing required request_id field')
      throw new MessageParseError()
    }

    if (message.timestamp === undefined || message.timestamp === null) {
      this.#log.error('Message missing required timestamp field')
      throw new MessageParseError()
    }

    if (!message.payload?.matrix_id) {
      this.#log.error('Message missing required matrix_id field in payload')
      this.#log.debug(
        `Message payload keys: ${Object.keys(message.payload || {}).join(', ')}`
      )
      throw new UserIdNotProvidedError()
    }

    const userId = message.payload.matrix_id
    const newVersion = message.version ?? 1
    const newTimestamp = message.timestamp
    const requestId = message.request_id
    const source = message.source

    this.#log.info(
      `Processing settings update for user: ${userId} (source=${source}, version=${newVersion}, request_id=${requestId}, timestamp=${this.#formatTimestamp(
        newTimestamp
      )})`
    )
    this.#log.debug(
      `Settings update contains: displayName=${!!message.payload
        .display_name}, avatar=${!!message.payload.avatar}, email=${!!message
        .payload.email}, phone=${!!message.payload.phone}`
    )

    // Get cached/stored settings for this user
    const lastSettings = await this.#getUserSettings(userId)

    // Idempotency check
    if (lastSettings && requestId === lastSettings.request_id) {
      this.#log.warn(
        `Duplicate message detected for ${userId} (request_id=${requestId}), discarding`
      )
      return
    }

    // Determine if we should apply this update
    const shouldApply = this.#shouldApplyUpdate(
      lastSettings,
      newVersion,
      newTimestamp
    )

    if (!shouldApply) {
      this.#log.warn(
        `Stale update for ${userId}, discarding (current: version=${
          lastSettings?.version
        }, timestamp=${
          lastSettings ? this.#formatTimestamp(lastSettings.timestamp) : 'N/A'
        }; new: version=${newVersion}, timestamp=${this.#formatTimestamp(
          newTimestamp
        )})`
      )
      return
    }

    this.#log.debug(
      `Applying update for ${userId} (${
        lastSettings
          ? `old version=${
              lastSettings.version
            }, timestamp=${this.#formatTimestamp(lastSettings.timestamp)}`
          : 'new user'
      } -> new version=${newVersion}, timestamp=${this.#formatTimestamp(
        newTimestamp
      )})`
    )

    // Apply the update
    await this.#applyUpdate(userId, message, lastSettings, newTimestamp)

    this.#log.info(`Successfully processed settings for user: ${userId}`)
  }

  /**
   * Determines whether an update should be applied based on version and timestamp.
   * @param lastSettings - The last known settings for the user, or null if new user
   * @param newVersion - The version number from the incoming message
   * @param newTimestamp - The timestamp from the incoming message (Unix ms)
   * @returns true if the update should be applied, false otherwise
   */
  #shouldApplyUpdate(
    lastSettings: UserSettings | null,
    newVersion: number,
    newTimestamp: number
  ): boolean {
    // New user - always apply
    if (!lastSettings) {
      this.#log.debug('No existing settings found, will apply update')
      return true
    }

    // Higher version - always apply
    if (newVersion > lastSettings.version) {
      this.#log.debug(
        `New version is higher (${newVersion} > ${lastSettings.version}), will apply update`
      )
      return true
    }

    // Same version but newer timestamp - apply
    if (
      newVersion === lastSettings.version &&
      newTimestamp > lastSettings.timestamp
    ) {
      this.#log.debug(
        `Same version but newer timestamp (${this.#formatTimestamp(
          newTimestamp
        )} > ${this.#formatTimestamp(
          lastSettings.timestamp
        )}), will apply update`
      )
      return true
    }

    // Otherwise, it's stale
    this.#log.debug(
      `Update is stale (version ${newVersion} <= ${
        lastSettings.version
      }, timestamp ${this.#formatTimestamp(
        newTimestamp
      )} <= ${this.#formatTimestamp(lastSettings.timestamp)})`
    )
    return false
  }

  /**
   * Applies the settings update to Matrix and updates the database cache.
   * @param userId - The Matrix user ID to update
   * @param message - The new settings message
   * @param lastSettings - The previous settings, or null if new user
   * @param newTimestamp - The timestamp from the message
   */
  async #applyUpdate(
    userId: string,
    message: CommonSettingsMessage,
    lastSettings: UserSettings | null,
    newTimestamp: number
  ): Promise<void> {
    const isNewUser = lastSettings === null
    const newVersion = message.version ?? 1

    // Process settings changes and update Matrix profile
    await this.#processSettingsChanges(
      userId,
      lastSettings?.payload ?? null,
      message.payload,
      isNewUser
    )

    // Update the database cache
    const cacheData = {
      matrix_id: userId,
      settings: JSON.stringify(message.payload),
      version: newVersion,
      timestamp: newTimestamp,
      request_id: message.request_id
    }

    if (isNewUser) {
      this.#log.debug(`Inserting new cache entry for ${userId}`)
      try {
        await this.#db.insert('usersettings', cacheData)
        this.#log.debug(`Successfully inserted cache entry for ${userId}`)
      } catch (error) {
        this.#log.error(
          `Failed to insert cache entry for ${userId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
        throw error
      }
    } else {
      this.#log.debug(`Updating cache entry for ${userId}`)
      try {
        await this.#db.update('usersettings', cacheData, 'matrix_id', userId)
        this.#log.debug(`Successfully updated cache entry for ${userId}`)
      } catch (error) {
        this.#log.error(
          `Failed to update cache entry for ${userId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
        throw error
      }
    }

    this.#log.debug(
      `Cache updated for ${userId}: version=${newVersion}, timestamp=${this.#formatTimestamp(
        newTimestamp
      )}, request_id=${message.request_id}`
    )
  }

  /**
   * Processes detected changes between old and new settings.
   * Updates Matrix display name and avatar if they have changed.
   * @param userId - The Matrix user ID to update
   * @param oldPayload - The previous settings payload, or null if new user
   * @param newPayload - The new settings payload from the AMQP message
   * @param isNewUser - Whether this is a newly created user record
   */
  async #processSettingsChanges(
    userId: string,
    oldPayload: SettingsPayload | null,
    newPayload: SettingsPayload,
    isNewUser: boolean
  ): Promise<void> {
    this.#log.debug(`Processing changes for ${userId} (isNewUser=${isNewUser})`)

    const displayNameChanged =
      isNewUser || oldPayload?.display_name !== newPayload.display_name
    const avatarChanged = isNewUser || oldPayload?.avatar !== newPayload.avatar

    this.#log.debug(
      `Change detection: displayName=${displayNameChanged} (old="${oldPayload?.display_name}", new="${newPayload.display_name}"), avatar=${avatarChanged} (old="${oldPayload?.avatar}", new="${newPayload.avatar}")`
    )

    if (displayNameChanged && newPayload.display_name) {
      this.#log.debug(`Display name change detected for ${userId}`)
      await this.#updateDisplayName(userId, newPayload.display_name)
    } else if (displayNameChanged && !newPayload.display_name) {
      this.#log.warn(
        `Display name changed but new value is empty for ${userId}`
      )
    }

    if (avatarChanged && newPayload.avatar) {
      this.#log.debug(`Avatar change detected for ${userId}`)
      await this.#updateAvatar(userId, newPayload.avatar)
    } else if (avatarChanged && !newPayload.avatar) {
      this.#log.warn(`Avatar changed but new value is empty for ${userId}`)
    }

    if (!displayNameChanged && !avatarChanged) {
      this.#log.debug(`No profile changes detected for ${userId}`)
    }
  }

  /**
   * Attempts to parse a JSON string into a CommonSettingsMessage object.
   * Returns null if parsing fails instead of throwing an error.
   * @param raw - The raw JSON string to parse
   * @returns The parsed message or null if parsing failed
   */
  #safeParseMessage(raw: string): CommonSettingsMessage | null {
    try {
      return JSON.parse(raw) as CommonSettingsMessage
    } catch (error) {
      this.#log.debug(
        `JSON parse error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      return null
    }
  }

  /**
   * Parses a settings payload from a JSON string.
   * Used when retrieving settings from the database.
   * @param raw - The raw JSON string to parse
   * @returns The parsed SettingsPayload or null if parsing failed
   */
  #safeParsePayload(raw: string): SettingsPayload | null {
    try {
      return JSON.parse(raw) as SettingsPayload
    } catch (error) {
      this.#log.warn(
        `Failed to parse settings payload from database: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      return null
    }
  }

  /**
   * Retrieves existing user settings from the database.
   * @param userId - The Matrix user ID to look up
   * @returns UserSettings object or null if user not found
   */
  async #getUserSettings(userId: string): Promise<UserSettings | null> {
    this.#log.debug(`Looking up user settings for ${userId}`)

    try {
      const result = await this.#db.get(
        'usersettings',
        ['matrix_id', 'settings', 'version', 'timestamp', 'request_id'],
        { matrix_id: userId }
      )

      if (result.length === 0) {
        this.#log.debug(`No existing settings found for ${userId}`)
        return null
      }

      const dbRow = result[0] as Record<string, unknown>
      const parsedSettings = this.#safeParsePayload(dbRow.settings as string)

      if (!parsedSettings) {
        this.#log.warn(
          `Settings for ${userId} in database are corrupted, treating as new user`
        )
        return null
      }

      this.#log.debug(
        `Found existing settings for ${userId}: version=${
          dbRow.version
        }, timestamp=${this.#formatTimestamp(
          dbRow.timestamp as number
        )}, request_id=${dbRow.request_id}`
      )

      return {
        nickname: dbRow.matrix_id as string,
        payload: parsedSettings,
        version: dbRow.version as number,
        timestamp: dbRow.timestamp as number,
        request_id: dbRow.request_id as string
      }
    } catch (error) {
      this.#log.error(
        `Error retrieving settings for ${userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      throw error
    }
  }

  /**
   * Gets a human-readable name for the retry mode
   * @param mode - The SynapseAdminRetryMode enum value
   * @returns String name of the mode
   */
  #getRetryModeName(mode: SynapseAdminRetryMode): string {
    switch (mode) {
      case SynapseAdminRetryMode.EXCLUSIVE:
        return 'EXCLUSIVE'
      case SynapseAdminRetryMode.FALLBACK:
        return 'FALLBACK'
      default:
        return 'DISABLED'
    }
  }

  /**
   * Updates a user's display name in Matrix.
   * Uses either the Synapse admin API or the standard intent API
   * based on the configured retry mode.
   * @param userId - The Matrix user ID to update
   * @param newDisplayname - The new display name to set
   */
  async #updateDisplayName(
    userId: string,
    newDisplayname: string
  ): Promise<void> {
    const retryMode = this.#getAdminRetryMode()
    this.#log.debug(
      `Updating display name for ${userId} (retryMode=${this.#getRetryModeName(
        retryMode
      )})`
    )

    if (retryMode === SynapseAdminRetryMode.EXCLUSIVE) {
      this.#log.debug(
        `Using admin API exclusively for display name update: ${userId}`
      )
      await this.#updateDisplayNameAdmin(userId, newDisplayname)
      return
    }

    const intent = this.#bridge.getIntent(userId)

    try {
      this.#log.debug(
        `Attempting standard API display name update for ${userId}`
      )
      await intent.setDisplayName(newDisplayname)
      this.#log.info(
        `Updated display name for ${userId} to "${newDisplayname}"`
      )
    } catch (err: any) {
      this.#log.warn(
        `Failed to update display name via standard API for ${userId}: ${
          err?.errcode || err?.message || 'Unknown error'
        }`
      )

      if (
        err?.errcode === 'M_FORBIDDEN' &&
        retryMode === SynapseAdminRetryMode.FALLBACK
      ) {
        this.#log.info(`Falling back to admin API for display name ${userId}`)
        await this.#updateDisplayNameAdmin(userId, newDisplayname)
      } else {
        this.#log.error(
          `Cannot update display name for ${userId}, exhausted all methods`
        )
        throw err
      }
    }
  }

  /**
   * Updates a user's display name using the Synapse admin API.
   * This bypasses normal permission checks and requires the bot to have admin privileges.
   * @param userId - The Matrix user ID to update
   * @param newDisplayname - The new display name to set
   */
  async #updateDisplayNameAdmin(
    userId: string,
    newDisplayname: string
  ): Promise<void> {
    this.#log.debug(`Calling admin API to update display name for ${userId}`)

    try {
      await this.#adminApis.upsertUser(userId, { displayname: newDisplayname })
      this.#log.info(
        `Updated display name via admin API for ${userId} to "${newDisplayname}"`
      )
    } catch (error) {
      this.#log.error(
        `Admin API failed to update display name for ${userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      throw error
    }
  }

  /**
   * Updates a user's avatar URL in Matrix.
   * Uses either the Synapse admin API or the standard intent API
   * based on the configured retry mode.
   * @param userId - The Matrix user ID to update
   * @param avatarUrl - The new avatar MXC URL to set
   */
  async #updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    const retryMode = this.#getAdminRetryMode()
    this.#log.debug(
      `Updating avatar for ${userId} (retryMode=${this.#getRetryModeName(
        retryMode
      )})`
    )

    if (retryMode === SynapseAdminRetryMode.EXCLUSIVE) {
      this.#log.debug(
        `Using admin API exclusively for avatar update: ${userId}`
      )
      await this.#updateAvatarAdmin(userId, avatarUrl)
      return
    }

    const intent = this.#bridge.getIntent(userId)

    try {
      this.#log.debug(`Attempting standard API avatar update for ${userId}`)
      await intent.setAvatarUrl(avatarUrl)
      this.#log.info(`Updated avatar for ${userId} to "${avatarUrl}"`)
    } catch (err: any) {
      this.#log.warn(
        `Failed to update avatar via standard API for ${userId}: ${
          err?.errcode || err?.message || 'Unknown error'
        }`
      )

      if (
        err?.errcode === 'M_FORBIDDEN' &&
        retryMode === SynapseAdminRetryMode.FALLBACK
      ) {
        this.#log.info(`Falling back to admin API for avatar ${userId}`)
        await this.#updateAvatarAdmin(userId, avatarUrl)
      } else {
        this.#log.error(
          `Cannot update avatar for ${userId}, exhausted all methods`
        )
        throw err
      }
    }
  }

  /**
   * Updates a user's avatar using the Synapse admin API.
   * This bypasses normal permission checks and requires the bot to have admin privileges.
   * @param userId - The Matrix user ID to update
   * @param avatarUrl - The new avatar MXC URL to set
   */
  async #updateAvatarAdmin(userId: string, avatarUrl: string): Promise<void> {
    this.#log.debug(`Calling admin API to update avatar for ${userId}`)

    try {
      await this.#adminApis.upsertUser(userId, { avatar_url: avatarUrl })
      this.#log.info(
        `Updated avatar via admin API for ${userId} to "${avatarUrl}"`
      )
    } catch (error) {
      this.#log.error(
        `Admin API failed to update avatar for ${userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      throw error
    }
  }

  /**
   * Converts the string configuration value for admin retry mode to the enum value.
   * Defaults to DISABLED if the configuration value is not recognized.
   * @returns The SynapseAdminRetryMode enum value
   */
  #getAdminRetryMode(): SynapseAdminRetryMode {
    const modeString = this.#config.synapse?.adminRetryMode
    switch (modeString) {
      case 'exclusive':
        return SynapseAdminRetryMode.EXCLUSIVE
      case 'fallback':
        return SynapseAdminRetryMode.FALLBACK
      default:
        return SynapseAdminRetryMode.DISABLED
    }
  }

  /**
   * Starts the bridge service.
   * Initializes the Matrix bridge, caches bot intent and admin APIs,
   * verifies admin privileges, waits for database readiness,
   * and starts the AMQP connector.
   */
  async start(): Promise<void> {
    this.#log.info('==========================================')
    this.#log.info('Common Settings Bridge Starting')
    this.#log.info('==========================================')

    try {
      this.#log.info('Initializing Matrix bridge...')
      this.#bridge = this.#initBridge()

      this.#log.debug('Running bridge on port 0 (disabled HTTP listener)...')
      await this.#bridge.run(0)
      this.#log.debug('Bridge started successfully')

      const botUserId = this.#bridge.getBot().getUserId()
      this.#log.info(`Bot user ID: ${botUserId}`)

      this.#log.debug('Ensuring bot is registered...')
      this.#botIntent = this.#bridge.getIntent(botUserId)
      await this.#botIntent.ensureRegistered()
      this.#log.debug('Bot registration confirmed')

      this.#log.debug('Initializing admin APIs...')
      this.#adminApis = this.#botIntent.matrixClient.adminApis.synapse

      this.#log.debug('Checking admin privileges...')
      const isAdmin = await this.#adminApis.isSelfAdmin()
      if (isAdmin) {
        this.#log.info(`Bot ${botUserId} has admin privileges`)
      } else {
        this.#log.warn(`Bot ${botUserId} does NOT have admin privileges`)
        this.#log.warn('Admin API fallback will not be available')
      }

      this.#log.info('Waiting for database to be ready...')
      await this.#db.ready
      this.#log.info('Database connection established')

      this.#log.info('Building AMQP connector...')
      await this.#connector.build()
      this.#log.info('AMQP connector ready')

      this.#log.info('------------------------------------------')
      this.#log.info('Common Settings Bridge Started')
      this.#log.info('------------------------------------------')
      this.#log.info('Service running. Waiting for messages...')
      this.#log.info('Press Ctrl+C to stop')
      this.#log.info('==========================================')
    } catch (error) {
      this.#log.error('==========================================')
      this.#log.error('FATAL ERROR DURING STARTUP:')
      this.#log.error(error instanceof Error ? error.message : String(error))
      if (error instanceof Error && error.stack) {
        this.#log.debug(`Stack trace: ${error.stack}`)
      }
      this.#log.error('==========================================')
      throw error
    }
  }

  /**
   * Gracefully stops the bridge service.
   * Closes the AMQP connector and database connections.
   */
  async stop(): Promise<void> {
    this.#log.info('')
    this.#log.info('==========================================')
    this.#log.info('Shutdown signal received...')
    this.#log.info('==========================================')

    try {
      this.#log.info('Closing AMQP connector...')
      await this.#connector.close()
      this.#log.info('AMQP connector closed')

      this.#log.info('Closing database connection...')
      this.#db.close()
      this.#log.info('Database closed')

      this.#log.info('==========================================')
      this.#log.info('Common Settings Bridge Stopped')
      this.#log.info('==========================================')
    } catch (error) {
      this.#log.error('Error during shutdown:')
      this.#log.error(error instanceof Error ? error.message : String(error))
      throw error
    }
  }
}

const log = new Logger('CLI')

/**
 * Configures the application service registration with tokens and user patterns.
 * This is called by the CLI when generating a new registration file.
 * @param reg - The AppServiceRegistration instance to configure
 */
const setupRegistration = (reg: AppServiceRegistration): void => {
  log.info('==========================================')
  log.info('Generating Registration File')
  log.info('==========================================')

  log.debug('Generating tokens...')
  const appServiceId = AppServiceRegistration.generateToken()
  const hsToken = AppServiceRegistration.generateToken()
  const asToken = AppServiceRegistration.generateToken()

  reg.setId(appServiceId)
  reg.setHomeserverToken(hsToken)
  reg.setAppServiceToken(asToken)
  reg.setSenderLocalpart('_common_settings_bridge')
  reg.addRegexPattern('users', '@.*', false)

  log.info('Registration configuration generated')
  log.debug(`App Service ID: ${appServiceId.substring(0, 10)}...`)
  log.debug('Sender localpart: _common_settings_bridge')
  log.debug('User namespace: @.*')
  log.info('==========================================')
}

/**
 * Entry point for starting the bridge from the CLI.
 * Creates and starts the CommonSettingsBridge with the provided configuration.
 * Sets up signal handlers for graceful shutdown.
 * @param port - The port number (unused, bridge runs on port 0)
 * @param config - The bridge configuration loaded from the config file
 */
const startBridge = (
  port: number | null,
  config: Record<string, unknown> | null
): void => {
  if (!config) {
    log.error('==========================================')
    log.error('ERROR: No configuration provided')
    log.error('==========================================')
    process.exit(1)
  }

  const bridgeConfig = config as unknown as BridgeConfig

  log.debug('Configuration loaded:')
  log.debug(`  Homeserver: ${bridgeConfig.homeserverUrl}`)
  log.debug(`  Domain: ${bridgeConfig.domain}`)
  log.debug(
    `  Database: ${bridgeConfig.database?.engine} (${bridgeConfig.database?.name})`
  )
  log.debug(
    `  RabbitMQ: ${bridgeConfig.rabbitmq?.host}:${bridgeConfig.rabbitmq?.port}`
  )

  const bridge = new CommonSettingsBridge(bridgeConfig)

  bridge.start().catch((err) => {
    log.error('==========================================')
    log.error('FATAL: Failed to start bridge')
    log.error(err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) {
      log.debug(`Stack trace: ${err.stack}`)
    }
    log.error('==========================================')
    process.exit(1)
  })

  const shutdown = async (): Promise<void> => {
    try {
      await bridge.stop()
      process.exit(0)
    } catch (error) {
      log.error(
        'Error during shutdown:',
        error instanceof Error ? error.message : String(error)
      )
      process.exit(1)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

new Cli({
  registrationPath: process.env.REGISTRATION_FILE ?? undefined,
  enableRegistration: true,
  bridgeConfig: { schema: {}, defaults: {} },
  generateRegistration: setupRegistration,
  run: startBridge
}).run()
