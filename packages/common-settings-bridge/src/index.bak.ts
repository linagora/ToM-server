/**
 * Common Settings Bridge - Main Entry Point
 *
 * Standalone service that bridges user profile updates from RabbitMQ
 * to Synapse homeserver via Application Service Protocol.
 */

import { getLogger, type TwakeLogger } from '@twake/logger'
import { validateConfig, loadConfig } from './config'
import { SettingsDatabase } from './db'
import { SynapseBridge } from './bridge'
import { SettingsConsumer } from './consumer'
import {
  type BridgeConfig,
  type CommonSettingsMessage,
  type UserProfileUpdate
} from './types'

// Re-export types for external use
export * from './types'
export * from './errors'
export { loadConfig, validateConfig } from './config'
export { SettingsDatabase } from './db'
export { SynapseBridge } from './bridge'
export { SettingsConsumer } from './consumer'

/**
 * Main bridge service class
 */
export class CommonSettingsBridge {
  private readonly config: BridgeConfig
  private readonly logger: TwakeLogger
  private readonly db: SettingsDatabase
  private readonly bridge: SynapseBridge
  private readonly consumer: SettingsConsumer
  private _started: boolean = false

  constructor(config: BridgeConfig, logger?: TwakeLogger) {
    validateConfig(config)
    this.config = config
    this.logger = logger ?? getLogger()

    // Initialize components
    this.db = new SettingsDatabase(config.database, this.logger)
    this.bridge = new SynapseBridge(config.synapse, this.logger)
    this.consumer = new SettingsConsumer(
      config.rabbitmq,
      config.queue,
      this.logger
    )

    // Set up message handler
    this.consumer.setMessageHandler(this.handleMessage.bind(this))
  }

  /**
   * Check if service is started
   */
  get isStarted(): boolean {
    return this._started
  }

  /**
   * Start the bridge service
   */
  async start(): Promise<void> {
    if (this._started) {
      this.logger.warn('[CommonSettingsBridge] Service already started')
      return
    }

    this.logger.info('[CommonSettingsBridge] Starting service...')

    try {
      // Wait for database to be ready
      await this.db.ready
      this.logger.info('[CommonSettingsBridge] Database ready')

      // Start Synapse bridge
      await this.bridge.start()
      this.logger.info('[CommonSettingsBridge] Synapse bridge started')

      // Start RabbitMQ consumer
      await this.consumer.start()
      this.logger.info('[CommonSettingsBridge] RabbitMQ consumer started')

      this._started = true
      this.logger.info('[CommonSettingsBridge] Service started successfully')
    } catch (error: any) {
      this.logger.error('[CommonSettingsBridge] Failed to start service', {
        error: error.message
      })
      // Attempt cleanup
      await this.stop()
      throw error
    }
  }

  /**
   * Stop the bridge service
   */
  async stop(): Promise<void> {
    this.logger.info('[CommonSettingsBridge] Stopping service...')

    // Stop consumer first (stop receiving new messages)
    await this.consumer.stop()

    // Stop bridge
    await this.bridge.stop()

    // Close database
    await this.db.close()

    this._started = false
    this.logger.info('[CommonSettingsBridge] Service stopped')
  }

  /**
   * Handle incoming message from RabbitMQ
   * @param message The parsed message
   */
  private async handleMessage(message: CommonSettingsMessage): Promise<void> {
    const { payload, version } = message
    const userId = payload.matrix_id

    // Modify display name to include " bridged" suffix
    let targetDisplayName = payload.display_name
    if (targetDisplayName && !targetDisplayName.endsWith(' bridged')) {
      targetDisplayName = `${targetDisplayName} bridged`
    }

    this.logger.info('[CommonSettingsBridge] Processing message', {
      userId,
      version,
      requestId: message.request_id,
      originalName: payload.display_name,
      targetName: targetDisplayName
    })

    try {
      // Get or create user settings
      const { userSettings, created } = await this.db.getOrCreateUserSettings(
        userId,
        payload,
        version
      )

      // Determine what needs to be updated
      let updatePayload: UserProfileUpdate = {}

      if (created) {
        // New user - update everything
        if (targetDisplayName) {
          updatePayload.displayName = targetDisplayName
        }
        if (payload.avatar) {
          updatePayload.avatarUrl = payload.avatar
        }
      } else {
        // Existing user - check for changes
        const changes = this.db.detectChanges(userSettings, payload)

        // Check if the name in Synapse needs updating (either changed or missing " bridged")
        const currentSynapseProfile = await this.bridge.getProfileInfo(userId)
        const needsNameBridgeSuffix =
          targetDisplayName &&
          (!currentSynapseProfile.displayname ||
            !currentSynapseProfile.displayname.endsWith(' bridged'))

        if (
          (changes.displayNameChanged || needsNameBridgeSuffix) &&
          targetDisplayName
        ) {
          updatePayload.displayName = targetDisplayName
        }

        if (changes.avatarChanged && payload.avatar) {
          updatePayload.avatarUrl = payload.avatar
        }
      }

      // Apply updates to Synapse if there are changes
      if (Object.keys(updatePayload).length > 0) {
        this.logger.info('[CommonSettingsBridge] Applying profile updates', {
          userId,
          changes: Object.keys(updatePayload)
        })
        await this.updateWithRetry(userId, updatePayload)
      } else {
        this.logger.info(
          '[CommonSettingsBridge] No changes detected, skipping update',
          {
            userId
          }
        )
      }

      // Update database with new settings
      if (!created) {
        await this.db.updateUserSettings(userId, payload, version)
      }

      this.logger.info(
        '[CommonSettingsBridge] Message processed successfully',
        {
          userId,
          version
        }
      )
    } catch (error: any) {
      this.logger.error('[CommonSettingsBridge] Failed to process message', {
        userId,
        error: error.message
      })
      throw error // Re-throw to NACK the message
    }
  }

  /**
   * Update user profile with retry logic
   * @param userId The Matrix user ID
   * @param update The profile updates
   * @param retries Number of retry attempts
   */
  private async updateWithRetry(
    userId: string,
    update: UserProfileUpdate,
    retries: number = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.debug('[CommonSettingsBridge] Update attempt', {
          userId,
          attempt,
          retries
        })
        await this.bridge.updateUserProfile(userId, update)
        return
      } catch (error: any) {
        if (attempt === retries) {
          throw error
        }
        this.logger.warn('[CommonSettingsBridge] Update failed, retrying', {
          userId,
          attempt,
          error: error.message
        })
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, attempt * 500))
      }
    }
  }
}

/**
 * Main entry point when run directly
 */
async function main(): Promise<void> {
  const logger = getLogger()

  logger.info('==========================================')
  logger.info('Common Settings Bridge Starting')
  logger.info('==========================================')

  try {
    // Load configuration from environment
    const config = loadConfig()

    // Create and start the bridge
    const bridge = new CommonSettingsBridge(config, logger)
    await bridge.start()

    logger.info('------------------------------------------')
    logger.info('Service running. Waiting for messages...')
    logger.info('Press Ctrl+C to stop')

    // Handle graceful shutdown
    const shutdown = async (): Promise<void> => {
      logger.info('\nShutdown signal received...')
      await bridge.stop()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  } catch (error: any) {
    logger.error('==========================================')
    logger.error('FATAL ERROR DURING STARTUP:')
    logger.error(error.message)
    logger.error('==========================================')
    process.exit(1)
  }
}

// Run main if this is the entry point
main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
