import { Bridge, Logger } from 'matrix-appservice-bridge'
import type { ConsumeMessage, Channel } from 'amqplib'
import { AMQPConnector } from '@twake/amqp-connector'
import { Database } from '@twake/db'
import type * as logger from '@twake/logger'
import {
  SynapseAdminRetryMode,
  createLoggerAdapter,
  type BridgeConfig,
  type UserSettingsTableName
} from './types'
import { SettingsRepository } from './settings-repository'
import {
  DEFAULT_AVATAR_FETCH_TIMEOUT_MS,
  DEFAULT_MAX_AVATAR_BYTES,
  MatrixProfileUpdater,
  type MatrixApis
} from './matrix-profile-updater'
import {
  MessageParseError,
  UserIdNotProvidedError,
  type UserSettings,
  type CommonSettingsMessage,
  type SettingsPayload
} from './types'

// =============================================================================
// Message handling helpers (inlined from message-handler.ts)
// =============================================================================

/**
 * Represents a validated and parsed message ready for processing.
 */
interface ParsedMessage {
  userId: string
  version: number
  timestamp: number
  requestId: string
  source: string
  payload: SettingsPayload
}

/**
 * Attempts to parse a JSON string into a CommonSettingsMessage object.
 */
function parseMessage(raw: string): CommonSettingsMessage | null {
  try {
    return JSON.parse(raw) as CommonSettingsMessage
  } catch (error) {
    return null
  }
}

/**
 * Validates a CommonSettingsMessage and extracts required fields.
 */
function validateMessage(message: CommonSettingsMessage): ParsedMessage {
  if (!message.request_id) {
    throw new MessageParseError('Message missing required request_id field')
  }
  if (message.timestamp === undefined || message.timestamp === null) {
    throw new MessageParseError('Message missing required timestamp field')
  }
  if (!message.payload?.matrix_id) {
    throw new UserIdNotProvidedError()
  }
  return {
    userId: message.payload.matrix_id,
    version: message.version ?? 1,
    timestamp: message.timestamp,
    requestId: message.request_id,
    source: message.source,
    payload: message.payload
  }
}

// =============================================================================
// Version management helpers (inlined from version-manager.ts)
// =============================================================================

/**
 * Determines whether an update should be applied based on version and timestamp.
 */
function shouldApplyUpdate(
  lastSettings: UserSettings | null,
  newVersion: number,
  newTimestamp: number
): boolean {
  if (!lastSettings) return true
  if (newVersion > lastSettings.version) return true
  if (
    newVersion === lastSettings.version &&
    newTimestamp > lastSettings.timestamp
  )
    return true
  return false
}

/**
 * Checks if an incoming update is an idempotent duplicate based on request ID.
 */
function isIdempotentDuplicate(
  lastSettings: UserSettings | null,
  newRequestId: string
): boolean {
  return lastSettings?.request_id === newRequestId
}

/**
 * Formats a Unix timestamp (milliseconds) as an ISO 8601 string.
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

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
export class CommonSettingsBridge {
  readonly #config: BridgeConfig
  readonly #log: Logger
  #bridge!: Bridge
  #adminApis!: any
  #db!: Database<UserSettingsTableName>
  #connector!: AMQPConnector
  #settingsRepository!: SettingsRepository
  #profileUpdater!: MatrixProfileUpdater

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
      database_ssl: this.#config.database.ssl ?? false,
      database_vacuum_delay: this.#config.database.vacuumDelay ?? 3600
    }

    this.#log.debug(
      `Database config: engine=${dbConfig.database_engine}, host=${dbConfig.database_host}, name=${dbConfig.database_name}, user=${dbConfig.database_user}, ssl=${dbConfig.database_ssl}, vacuumDelay=${dbConfig.database_vacuum_delay}s`
    )

    const dbLogger = createLoggerAdapter(this.#log, 'DB')

    const tables: Record<UserSettingsTableName, string> = {
      usersettings:
        "matrix_id varchar(255) PRIMARY KEY, settings jsonb, version int DEFAULT 1, timestamp bigint DEFAULT 0, request_id varchar(255) DEFAULT ''"
    }

    this.#db = new Database<UserSettingsTableName>(
      dbConfig,
      dbLogger as logger.TwakeLogger,
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

    const amqpLogger = createLoggerAdapter(this.#log, 'AMQP')
    const rabbitConfig = this.#config.rabbitmq

    this.#log.debug(
      `RabbitMQ config: host=${rabbitConfig.host}, exchange=${rabbitConfig.exchange}, queue=${rabbitConfig.queue}, routingKey=${rabbitConfig.routingKey}`
    )

    this.#connector = new AMQPConnector(amqpLogger as logger.TwakeLogger)
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
   * Handles incoming AMQP messages containing user settings changes.
   * Implements idempotency checking and version-based ordering.
   * @param msg - The AMQP message containing settings data
   * @param channel - The AMQP channel for acknowledgment
   */
  async #handleMessage(msg: ConsumeMessage, channel: Channel): Promise<void> {
    this.#log.debug('Received AMQP message')

    const rawContent = msg.content.toString()
    this.#log.debug(`Message content length: ${rawContent.length} bytes`)

    // Parse message
    const message = parseMessage(rawContent)

    if (message === null) {
      this.#log.error('Failed to parse message content')
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.LOG_RAW_MESSAGES === 'true'
      ) {
        this.#log.debug(
          `Raw message content: ${rawContent.substring(0, 200)}...`
        )
      } else {
        this.#log.debug(
          'Raw message content omitted (enable LOG_RAW_MESSAGES=true to view)'
        )
      }
      throw new MessageParseError()
    }

    // Validate message
    let parsed: ParsedMessage
    try {
      parsed = validateMessage(message)
    } catch (error) {
      this.#log.error(
        `Message validation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      throw error
    }

    const { userId, version, timestamp, requestId, source, payload } = parsed

    this.#log.info(
      `Processing settings update for user: ${userId} (source=${source}, version=${version}, request_id=${requestId}, timestamp=${formatTimestamp(
        timestamp
      )})`
    )
    this.#log.debug(
      `Settings update contains: displayName=${!!payload.display_name}, avatar=${!!payload.avatar}, email=${!!payload.email}, phone=${!!payload.phone}`
    )

    // Get cached/stored settings for this user
    const lastSettings = await this.#settingsRepository.getUserSettings(userId)

    // Idempotency check
    if (isIdempotentDuplicate(lastSettings, requestId)) {
      this.#log.warn(
        `Duplicate message detected for ${userId} (request_id=${requestId}), discarding`
      )
      return
    }

    // Determine if we should apply this update
    const shouldApply = shouldApplyUpdate(lastSettings, version, timestamp)

    if (!shouldApply) {
      this.#log.warn(
        `Stale update for ${userId}, discarding (current: version=${
          lastSettings?.version
        }, timestamp=${
          lastSettings ? formatTimestamp(lastSettings.timestamp) : 'N/A'
        }; new: version=${version}, timestamp=${formatTimestamp(timestamp)})`
      )
      return
    }

    this.#log.debug(
      `Applying update for ${userId} (${
        lastSettings
          ? `old version=${lastSettings.version}, timestamp=${formatTimestamp(
              lastSettings.timestamp
            )}`
          : 'new user'
      } -> new version=${version}, timestamp=${formatTimestamp(timestamp)})`
    )

    const isNewUser = lastSettings === null

    // Process settings changes and update Matrix profile
    await this.#profileUpdater.processChanges(
      userId,
      lastSettings?.payload ?? null,
      payload,
      isNewUser
    )

    // Save settings to database
    await this.#settingsRepository.saveSettings(
      userId,
      payload,
      version,
      timestamp,
      requestId,
      isNewUser
    )

    this.#log.info(`Successfully processed settings for user: ${userId}`)
  }

  /**
   * Converts the string configuration value for admin retry mode to the enum value.
   * Defaults to DISABLED if the configuration value is not recognized.
   * @returns The SynapseAdminRetryMode enum value
   */
  #getAdminRetryMode(): SynapseAdminRetryMode {
    const mode = this.#config.synapse?.adminRetryMode
    const validModes = Object.values(SynapseAdminRetryMode)
    return validModes.includes(mode as SynapseAdminRetryMode)
      ? (mode as SynapseAdminRetryMode)
      : SynapseAdminRetryMode.DISABLED
  }

  /**
   * Creates a MatrixApis implementation that wraps the bridge's Matrix operations.
   * @returns MatrixApis implementation
   */
  #createMatrixApis(): MatrixApis {
    return {
      getIntent: (userId: string) => this.#bridge.getIntent(userId),
      adminUpsertUser: async (userId: string, data: Record<string, string>) => {
        await this.#adminApis.upsertUser(userId, data)
      }
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
      const botIntent = this.#bridge.getIntent(botUserId)
      await botIntent.ensureRegistered()
      this.#log.debug('Bot registration confirmed')

      this.#log.debug('Initializing admin APIs...')
      this.#adminApis = botIntent.matrixClient.adminApis.synapse

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

      // Ensure all required columns exist (handles schema migrations)
      this.#log.info('Ensuring database schema is up to date...')
      await this.#db.ensureColumns('usersettings', [
        { name: 'settings', type: 'jsonb', default: null },
        { name: 'version', type: 'int', default: 1 },
        { name: 'timestamp', type: 'bigint', default: 0 },
        { name: 'request_id', type: 'varchar(255)', default: '' }
      ])
      this.#log.info('Database schema verified')

      // Initialize repository and updater with dependencies
      this.#log.debug('Initializing settings repository...')
      this.#settingsRepository = new SettingsRepository(this.#db, this.#log)

      this.#log.debug('Initializing profile updater...')
      const retryMode = this.#getAdminRetryMode()
      const matrixApis = this.#createMatrixApis()
      this.#profileUpdater = new MatrixProfileUpdater(
        matrixApis,
        retryMode,
        this.#log,
        {
          maxSizeBytes:
            this.#config.synapse.avatarMaxSizeBytes ?? DEFAULT_MAX_AVATAR_BYTES,
          fetchTimeoutMs:
            this.#config.synapse.avatarFetchTimeoutMs ??
            DEFAULT_AVATAR_FETCH_TIMEOUT_MS
        }
      )

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
      if (this.#connector) {
        this.#log.info('Closing AMQP connector...')
        await this.#connector.close()
        this.#log.info('AMQP connector closed')
      }

      if (this.#db) {
        this.#log.info('Closing database connection...')
        this.#db.close()
        this.#log.info('Database closed')
      }

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
