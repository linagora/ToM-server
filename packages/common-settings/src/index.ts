import { type TwakeLogger } from '@twake/logger'
import { AMQPConnector } from '@twake/amqp-connector'
import { type AmqpConfig } from '@twake/amqp-connector/src/types'
import {
  type UserSettings,
  type UserInformationPayload,
  type CommonSettingsMessage
} from './types'
import type { Config, TwakeDB } from '@twake/server/src/types'
import {
  ConfigNotProvidedError,
  CouldNotParseMessageError,
  ExchangeNotProvidedError,
  QueueNotProvidedError,
  UserIdNotProvidedError,
  UserSettingsNotProvidedError
} from './errors'

export class CommonSettingsService {
  private readonly config: Partial<Config>
  private readonly logger: TwakeLogger
  private readonly db: TwakeDB

  private readonly connector: AMQPConnector
  private readonly amqpConfig: AmqpConfig
  private readonly exchangeName: string
  private readonly queueName: string
  private readonly queueOptions: Record<string, any> = {}

  constructor(config: Config, logger: TwakeLogger, db: TwakeDB) {
    this.config = config
    this.logger = logger
    this.db = db

    // Parse the AMQP URL and Queue name from config
    this.amqpConfig = this.config.rabbitmq ?? {
      host: '',
      port: 5672,
      vhost: '/',
      username: '',
      password: '',
      tls: false
    }
    this.exchangeName = this.config.features?.common_settings?.exchange ?? ''
    this.queueName = this.config.features?.common_settings?.queue ?? ''
    this.queueOptions = {
      durable: true,
      deadLetterExchange:
        this.config.features?.common_settings?.deadLetterExchange,
      deadLetterRoutingKey:
        this.config.features?.common_settings?.deadLetterRoutingKey
    }

    // Validate configuration
    // Ensure AMQP URL, Exchnage and Queue name are provided
    if (this.amqpConfig.host.length === 0) throw new ConfigNotProvidedError()
    if (this.exchangeName.length === 0) throw new ExchangeNotProvidedError()
    if (this.queueName.length === 0) throw new QueueNotProvidedError()

    // Initialize AMQP Connector
    this.connector = new AMQPConnector(this.logger)
      .withConfig(this.amqpConfig)
      .withExchange(this.exchangeName, { durable: true })
      .withQueue(
        this.queueName,
        this.queueOptions,
        this.config.features?.common_settings?.routingKey
      )
      .onMessage(this.handleMessage.bind(this))
  }

  /**
   * Start listening for settings updates
   */
  async start(): Promise<void> {
    if (this.config.features?.common_settings?.enabled !== true) {
      this.logger.info(
        '[CommonSettingsService] Feature is disabled in configuration, skipping service'
      )
      return
    }
    this.logger.info(`[CommonSettingsService] Starting service...`)
    await this.connector.build()
    this.logger.info(
      '[CommonSettingsService] Service started and listening for messages'
    )
  }

  /**
   * Stop listening and close AMQP connection
   */
  async stop(): Promise<void> {
    this.logger.info('[CommonSettingsService] Stopping service')
    await this.connector.close()
    this.logger.info('[CommonSettingsService] Service stopped')
  }

  /**
   * Internal message handler
   *
   * @param rawMsg The raw AMQP message
   * @returns Promise that resolves when message processing is complete
   * @throws Logs errors if message processing fails
   */
  private async handleMessage(rawMsg: any): Promise<void> {
    // Log the raw message for debugging
    const rawContent = rawMsg.content.toString()
    this.logger.info('[CommonSettingsService] Received message', {
      raw: rawContent
    })

    // Parse and validate message
    const parsed = this._safeParseMessage(rawContent)
    if (parsed == null) throw new CouldNotParseMessageError()

    const {
      matrix_id: userId,
      display_name: displayName,
      avatar: avatarUrl
    } = parsed.payload ?? {}

    // Validate required fields
    // If missing, log a warning and skip processing
    if (userId == null) {
      this.logger.warn(
        '[CommonSettingsService] Invalid message payload: missing userId',
        { payload: parsed }
      )
      throw new UserIdNotProvidedError()
    }

    try {
      this.logger.info(
        '[CommonSettingsService] Updating the user information: ',
        { userId, displayName }
      )
      const { userSettings, created } = await this._getOrCreateUserSettings(
        userId,
        parsed
      )

      let updatePayload: Record<string, any> = {}

      // Update display name and avatar if changed or if new record
      if (created) {
        updatePayload = { displayName, avatarUrl }
      } else {
        const { settings: oldConfig, version } = userSettings
        this.logger.info(
          `[CommonSettingsService] Comparing with existing version ${version}`,
          { userId }
        )

        if (oldConfig.display_name !== displayName) {
          updatePayload.displayName = displayName
        }
        if (oldConfig.avatar !== avatarUrl) {
          updatePayload.avatarUrl = avatarUrl
        }
      }

      // If there are changes, update user information
      if (Object.keys(updatePayload).length > 0) {
        this.logger.info(
          '[CommonSettingsService] Detected changes, updating user information',
          { userId, updatePayload }
        )
        await this._updateUserInformationWithRetry(userId, updatePayload)
      }
      // Update or insert user settings in the database
      await this._updateUserSettings(userId, parsed)
      this.logger.info(
        '[CommonSettingsService] Successfully updated the user information: ',
        { userId }
      )
    } catch (err: any) {
      this.logger.error(
        '[CommonSettingsService] Failed to update the user information: ',
        {
          userId,
          error: err?.message
        }
      )
      throw err
    }
  }

  /**
   * Safe JSON parsing
   *
   * @param raw The raw JSON string
   * @returns Parsed object or null if parsing fails
   * @throws Logs a warning if parsing fails
   */
  private _safeParseMessage(raw: string): CommonSettingsMessage | null {
    try {
      return JSON.parse(raw)
    } catch (e: any) {
      this.logger.warn(
        '[CommonSettingsService] Invalid JSON message received',
        { raw },
        JSON.stringify(e)
      )
      return null
    }
  }

  /**
   * Updates user information with retries
   *
   * @param userId The ID of the user to update
   * @param payload The update payload
   * @param retries The number of retry attempts
   * @returns Promise that resolves when the update is successful or rejects after all retries fail
   * @throws Logs warnings on retry attempts and throws the last error if all retries fail
   */
  private async _updateUserInformationWithRetry(
    userId: string,
    payload: UserInformationPayload,
    retries = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.info(
          `[CommonSettingsService] Attempt ${attempt} to update user ${userId}`
        )
        await this._updateUserInformation(userId, payload)
        return
      } catch (err: any) {
        if (attempt === retries) throw err
        this.logger.warn(
          `[CommonSettingsService] Retry ${attempt} for user ${userId} due to error`,
          { error: err.message }
        )
        // eslint-disable-next-line promise/param-names
        await new Promise((res) => setTimeout(res, attempt * 500))
      }
    }
  }

  /**
   * Calls local admin settings API to update a user’s display name
   *
   * @param userId The ID of the user to update
   * @param payload The update payload
   * @returns Promise that resolves when the update is successful
   * @throws Throws an error if the HTTP request fails or returns a non-2xx status
   */
  private async _updateUserInformation(
    userId: string,
    payload: UserInformationPayload
  ): Promise<void> {
    if (
      this.config.base_url == null ||
      this.config.admin_access_token == null
    ) {
      throw new Error('The base URL or admin access token is not configured')
    }

    const base = new URL(this.config.base_url) // validates
    const endpoint = new URL(
      `/_twake/v1/admin/settings/information/${encodeURIComponent(userId)}`,
      base
    )

    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        Authorization: `Bearer ${this.config.admin_access_token}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to update display name: ${response.status} ${response.statusText} - ${errorText}`
      )
    }
  }

  /**
   * Get existing user settings or create them if not present.
   *
   * @param userId The ID of the user
   * @param settings The settings payload to create if not existing
   * @returns The user settings and a flag indicating if they were created
   * @throws Errors if database operations fail
   */
  private async _getOrCreateUserSettings(
    userId: string,
    settings: CommonSettingsMessage
  ): Promise<{ userSettings: UserSettings; created: boolean }> {
    try {
      if (userId.length === 0) throw new Error('UserId is required')

      if (settings?.payload == null)
        throw new Error('Settings payload is missing')

      const existing = (await this.db.get('usersettings', ['*'], {
        matrix_id: userId
      })) as unknown as UserSettings[]

      if (Array.isArray(existing) && existing.length > 0) {
        this.logger?.info(
          '[CommonSettingsService] Found existing user settings',
          { userId }
        )
        return { userSettings: existing[0], created: false }
      }

      const insertPayload = {
        matrix_id: userId,
        settings: JSON.stringify(settings.payload), // ORM expects a string
        version: settings.version
      }

      const insertResult = (await this.db.insert(
        'usersettings',
        insertPayload
      )) as unknown as UserSettings

      this.logger?.info('[CommonSettingsService] Created new user settings', {
        userId
      })
      return { userSettings: insertResult, created: true }
    } catch (err: any) {
      this.logger?.error(
        '[CommonSettingsService] Failed to get or create user settings',
        {
          userId,
          error: err?.message
        }
      )
      throw err
    }
  }

  /**
   * Update existing user settings.
   *
   * @param userId The ID of the user
   * @param settings The new settings payload
   * @returns Promise that resolves when the update is complete
   * @throws Errors if database operations fail
   */
  private async _updateUserSettings(
    userId: string,
    settings: CommonSettingsMessage
  ): Promise<void> {
    try {
      if (userId.length === 0) throw new UserIdNotProvidedError()

      if (settings?.payload == null) throw new UserSettingsNotProvidedError()

      const updatePayload = {
        settings: JSON.stringify(settings.payload), // ORM expects a string
        version: settings.version
      }

      // Update the user settings in the database
      await this.db.update('usersettings', updatePayload, 'matrix_id', userId)

      this.logger?.info('[CommonSettingsService] Updated user settings', {
        userId
      })
    } catch (err: any) {
      this.logger?.error(
        '[CommonSettingsService] Failed to update user settings',
        {
          userId,
          error: err?.message
        }
      )
      throw err
    }
  }
}
