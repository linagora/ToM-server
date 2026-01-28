/**
 * Synapse bridge wrapper using matrix-appservice-bridge
 * Handles profile updates via Application Service Protocol or Synapse Admin API
 */

import { Bridge } from 'matrix-appservice-bridge'
import { type TwakeLogger } from '@twake/logger'
import { type SynapseConfig, type UserProfileUpdate } from './types'
import { BridgeOperationError, AvatarUploadError } from './errors'

/**
 * Wrapper around matrix-appservice-bridge for Synapse profile updates
 */
export class SynapseBridge {
  private readonly logger: TwakeLogger
  private readonly config: SynapseConfig
  private bridge: Bridge | null = null
  private _started: boolean = false

  constructor(config: SynapseConfig, logger: TwakeLogger) {
    this.config = config
    this.logger = logger
  }

  /**
   * Check if bridge is started
   */
  get isStarted(): boolean {
    return this._started
  }

  /**
   * Initialize and start the bridge
   * Note: We don't need an HTTP listener since we're RabbitMQ-driven
   */
  async start(): Promise<void> {
    if (this._started) {
      this.logger.warn('[SynapseBridge] Bridge already started')
      return
    }

    this.logger.info('[SynapseBridge] Initializing bridge...', {
      homeserverUrl: this.config.homeserverUrl,
      domain: this.config.domain,
      adminMode: this.config.adminApiMode ?? 'disabled'
    })

    try {
      this.bridge = new Bridge({
        homeserverUrl: this.config.homeserverUrl,
        domain: this.config.domain,
        registration: this.config.registrationPath,
        disableStores: true,

        controller: {
          // We don't need to handle events from Synapse
          // This bridge is RabbitMQ-driven only
          onEvent: async () => {
            // No-op: we only push updates, don't react to events
          },
          onUserQuery: (matrixUser) => {
            this.logger.debug('[SynapseBridge] User query', {
              userId: matrixUser.getId()
            })
            return {}
          }
        }
      })

      // Start bridge without HTTP listener for RabbitMQ-only mode
      // Use port 0 to disable HTTP listener, or a high port if needed
      await this.bridge.run(0)
      this._started = true

      // Verify bot identity
      try {
        const botUserId = this.bridge.getBot().getUserId()
        this.logger.info('[SynapseBridge] Bridge started successfully', {
          botUserId
        })
      } catch (e) {
        this.logger.warn(
          '[SynapseBridge] Could not verify bot identity - Synapse may not be ready'
        )
      }
    } catch (error: any) {
      this.logger.error('[SynapseBridge] Failed to start bridge', {
        error: error.message
      })
      throw new BridgeOperationError('start', error.message)
    }
  }

  /**
   * Update user profile (display name and/or avatar)
   * Dispatches to standard or admin API based on configuration
   * @param userId The Matrix user ID (e.g., @user:domain)
   * @param update The profile updates to apply
   */
  async updateUserProfile(
    userId: string,
    update: UserProfileUpdate
  ): Promise<void> {
    if (!this._started || !this.bridge) {
      throw new BridgeOperationError('updateUserProfile', 'Bridge not started')
    }

    const mode = this.config.adminApiMode ?? 'disabled'

    // Exclusive Admin API Mode
    if (mode === 'exclusive') {
      await this.updateProfileViaAdminApi(userId, update)
      return
    }

    // Standard Mode (with potential fallback)
    try {
      await this.updateProfileStandard(userId, update)
    } catch (error: any) {
      if (mode === 'fallback') {
        this.logger.warn(
          '[SynapseBridge] Standard profile update failed, attempting Admin API fallback',
          {
            userId,
            error: error.message
          }
        )
        await this.updateProfileViaAdminApi(userId, update)
      } else {
        throw error
      }
    }
  }

  /**
   * Standard Update Logic (Masquerading as user)
   */
  private async updateProfileStandard(
    userId: string,
    update: UserProfileUpdate
  ): Promise<void> {
    // We assume bridge is checked by caller
    const intent = this.bridge!.getIntent(userId)

    try {
      // Update display name if provided
      if (update.displayName !== undefined) {
        this.logger.info('[SynapseBridge] Updating display name (Standard)', {
          userId,
          displayName: update.displayName
        })
        await intent.setDisplayName(update.displayName)
      }

      // Update avatar if provided
      if (update.avatarUrl !== undefined) {
        this.logger.info('[SynapseBridge] Updating avatar (Standard)', {
          userId,
          avatarUrl: update.avatarUrl
        })

        // If avatarUrl is an external URL, we need to upload it first
        if (
          update.avatarUrl.startsWith('http://') ||
          update.avatarUrl.startsWith('https://')
        ) {
          // Use the intent of the user to upload
          const mxcUrl = await this.uploadAvatarInternal(
            intent,
            userId,
            update.avatarUrl
          )
          await intent.setAvatarUrl(mxcUrl)
        } else if (update.avatarUrl.startsWith('mxc://')) {
          // Already an MXC URL
          await intent.setAvatarUrl(update.avatarUrl)
        } else {
          this.logger.warn('[SynapseBridge] Invalid avatar URL format', {
            avatarUrl: update.avatarUrl
          })
        }
      }

      this.logger.info(
        '[SynapseBridge] Profile updated successfully (Standard)',
        { userId }
      )
    } catch (error: any) {
      this.logger.error('[SynapseBridge] Failed to update profile (Standard)', {
        userId,
        error: error.message
      })
      throw new BridgeOperationError('updateUserProfile', error.message)
    }
  }

  /**
   * Admin API Update Logic (Using Bot token against Admin Endpoint)
   */
  private async updateProfileViaAdminApi(
    userId: string,
    update: UserProfileUpdate
  ): Promise<void> {
    // Get the bot's intent to retrieve the AS token/bot token
    const botUserId = this.bridge!.getBot().getUserId()
    const botIntent = this.bridge!.getIntent(botUserId)
    const token = botIntent.matrixClient.accessToken

    if (!token) {
      throw new BridgeOperationError(
        'updateProfileViaAdminApi',
        'Could not retrieve access token for bridge bot'
      )
    }

    try {
      const body: any = {}

      if (update.displayName !== undefined) {
        body.displayname = update.displayName
      }

      // Handle Avatar
      if (update.avatarUrl !== undefined) {
        let avatarUrl = update.avatarUrl

        // If external, upload first
        // Note: We upload using the BOT's intent to avoid permission issues if the target user is broken
        if (
          avatarUrl.startsWith('http://') ||
          avatarUrl.startsWith('https://')
        ) {
          this.logger.info('[SynapseBridge] Uploading avatar for Admin API', {
            userId
          })
          avatarUrl = await this.uploadAvatarInternal(
            botIntent,
            userId,
            avatarUrl
          )
        }

        if (avatarUrl.startsWith('mxc://')) {
          body.avatar_url = avatarUrl
        } else {
          this.logger.warn(
            '[SynapseBridge] Invalid avatar URL format (Admin API)',
            { avatarUrl }
          )
        }
      }

      if (Object.keys(body).length === 0) {
        return
      }

      this.logger.info('[SynapseBridge] Updating profile via Admin API', {
        userId,
        body
      })

      // Call Synapse Admin API
      const url = `${
        this.config.homeserverUrl
      }/_synapse/admin/v2/users/${encodeURIComponent(userId)}`
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Admin API error ${response.status}: ${text}`)
      }

      this.logger.info(
        '[SynapseBridge] Profile updated successfully (Admin API)',
        { userId }
      )
    } catch (error: any) {
      this.logger.error(
        '[SynapseBridge] Failed to update profile (Admin API)',
        {
          userId,
          error: error.message
        }
      )
      throw new BridgeOperationError('updateUserProfileAdmin', error.message)
    }
  }

  /**
   * Upload avatar from external URL
   * Public wrapper that uses standard user intent by default
   */
  async uploadAvatarFromUrl(
    userId: string,
    externalUrl: string
  ): Promise<string> {
    if (!this._started || !this.bridge) {
      throw new BridgeOperationError(
        'uploadAvatarFromUrl',
        'Bridge not started'
      )
    }

    const intent = this.bridge.getIntent(userId)
    return this.uploadAvatarInternal(intent, userId, externalUrl)
  }

  /**
   * Internal helper to upload avatar using a specific intent
   * Shared by both Standard and Admin paths
   */
  private async uploadAvatarInternal(
    intent: any,
    logUserId: string,
    externalUrl: string
  ): Promise<string> {
    try {
      this.logger.info('[SynapseBridge] Fetching avatar from external URL', {
        userId: logUserId,
        url: externalUrl
      })

      // Fetch the image
      const response = await fetch(externalUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') ?? 'image/png'
      const buffer = Buffer.from(await response.arrayBuffer())

      // Upload to Synapse media repository via the provided intent
      const mxcUrl = await intent.uploadContent(buffer, {
        name: 'avatar',
        type: contentType
      })

      this.logger.info('[SynapseBridge] Avatar uploaded successfully', {
        userId: logUserId,
        mxcUrl
      })

      return mxcUrl
    } catch (error: any) {
      this.logger.error('[SynapseBridge] Failed to upload avatar', {
        userId: logUserId,
        externalUrl,
        error: error.message
      })
      throw new AvatarUploadError(logUserId, error.message)
    }
  }

  /**
   * Get current profile info for a user
   * @param userId The Matrix user ID
   * @returns Profile info (displayname, avatar_url)
   */
  async getProfileInfo(
    userId: string
  ): Promise<{ displayname?: string; avatar_url?: string }> {
    if (!this._started || !this.bridge) {
      throw new BridgeOperationError('getProfileInfo', 'Bridge not started')
    }

    const intent = this.bridge.getIntent(userId)

    try {
      const profile = await intent.getProfileInfo(userId)
      return {
        displayname: profile.displayname,
        avatar_url: profile.avatar_url
      }
    } catch (error: any) {
      this.logger.debug('[SynapseBridge] Could not get profile info', {
        userId,
        error: error.message
      })
      return {}
    }
  }

  /**
   * Stop the bridge
   */
  async stop(): Promise<void> {
    if (!this._started || !this.bridge) {
      return
    }

    try {
      await this.bridge.close()
      this._started = false
      this.bridge = null
      this.logger.info('[SynapseBridge] Bridge stopped')
    } catch (error: any) {
      this.logger.warn('[SynapseBridge] Error stopping bridge', {
        error: error.message
      })
    }
  }
}
