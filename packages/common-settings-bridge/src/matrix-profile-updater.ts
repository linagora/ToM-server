import { type Logger, type Intent } from 'matrix-appservice-bridge'
import { SynapseAdminRetryMode, type SettingsPayload } from './types'

/**
 * Interface for Matrix API operations required by the profile updater.
 * Allows for dependency injection and testing.
 */
export interface MatrixApis {
  /**
   * Gets an Intent object for performing actions as a specific user.
   * @param userId - The Matrix user ID
   * @returns Intent object for the user
   */
  getIntent(userId: string): Intent

  /**
   * Upserts a user via the Synapse admin API.
   * @param userId - The Matrix user ID
   * @param data - User data to update (displayname, avatar_url, etc.)
   */
  adminUpsertUser(userId: string, data: Record<string, string>): Promise<void>
}

/**
 * Handles Matrix profile updates (display name and avatar) with configurable
 * retry strategies using either standard Matrix client API or Synapse admin API.
 *
 * Supports three retry modes:
 * - DISABLED: Only uses standard API, fails if forbidden
 * - FALLBACK: Tries standard API first, falls back to admin API on M_FORBIDDEN
 * - EXCLUSIVE: Only uses admin API
 */
export class MatrixProfileUpdater {
  constructor(
    private readonly apis: MatrixApis,
    private readonly retryMode: SynapseAdminRetryMode,
    private readonly logger: Logger
  ) {}

  /**
   * Updates a user's display name in Matrix.
   * Uses either the Synapse admin API or the standard intent API
   * based on the configured retry mode.
   * @param userId - The Matrix user ID to update
   * @param newDisplayname - The new display name to set
   */
  async updateDisplayName(
    userId: string,
    newDisplayname: string
  ): Promise<void> {
    this.logger.debug(
      `Updating display name for ${userId} (retryMode=${this.#getRetryModeName(
        this.retryMode
      )})`
    )

    if (this.retryMode === SynapseAdminRetryMode.EXCLUSIVE) {
      this.logger.debug(
        `Using admin API exclusively for display name update: ${userId}`
      )
      await this.#updateDisplayNameAdmin(userId, newDisplayname)
      return
    }

    const intent = this.apis.getIntent(userId)

    try {
      this.logger.debug(
        `Attempting standard API display name update for ${userId}`
      )
      await intent.setDisplayName(newDisplayname)
      this.logger.info(
        `Updated display name for ${userId} to "${newDisplayname}"`
      )
    } catch (err: any) {
      this.logger.warn(
        `Failed to update display name via standard API for ${userId}: ${
          err?.errcode || err?.message || 'Unknown error'
        }`
      )

      if (
        err?.errcode === 'M_FORBIDDEN' &&
        this.retryMode === SynapseAdminRetryMode.FALLBACK
      ) {
        this.logger.info(`Falling back to admin API for display name ${userId}`)
        await this.#updateDisplayNameAdmin(userId, newDisplayname)
      } else {
        this.logger.error(
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
    this.logger.debug(`Calling admin API to update display name for ${userId}`)

    try {
      await this.apis.adminUpsertUser(userId, { displayname: newDisplayname })
      this.logger.info(
        `Updated display name via admin API for ${userId} to "${newDisplayname}"`
      )
    } catch (error) {
      this.logger.error(
        `Admin API failed to update display name for ${userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      throw error
    }
  }

  /**
   * Resolves an avatar URL to an MXC URL.
   * If the URL is already an MXC URL, returns it as-is.
   * If the URL is an HTTP/HTTPS URL, downloads and uploads it to Synapse.
   * @param userId - The Matrix user ID (used for logging and intent)
   * @param avatarUrl - The avatar URL to resolve (can be mxc:// or http(s)://)
   * @returns The MXC URL for the avatar
   */
  async #resolveAvatarUrl(userId: string, avatarUrl: string): Promise<string> {
    if (avatarUrl.startsWith('mxc://')) {
      this.logger.debug(`Avatar URL is already MXC format: ${avatarUrl}`)
      return avatarUrl
    }

    this.logger.info(
      `Downloading avatar from external URL for ${userId}: ${avatarUrl}`
    )

    try {
      const intent = this.apis.getIntent(userId)
      const mxcUrl = await intent.matrixClient.uploadContentFromUrl(avatarUrl)
      this.logger.info(`Uploaded avatar to Synapse for ${userId}: ${mxcUrl}`)
      return mxcUrl
    } catch (error) {
      this.logger.error(
        `Failed to download/upload avatar for ${userId} from ${avatarUrl}: ${
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
   * If the avatar URL is not an MXC URL, it will be downloaded and uploaded first.
   * @param userId - The Matrix user ID to update
   * @param avatarUrl - The avatar URL to set (can be mxc:// or http(s)://)
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    const resolvedUrl = await this.#resolveAvatarUrl(userId, avatarUrl)

    this.logger.debug(
      `Updating avatar for ${userId} (retryMode=${this.#getRetryModeName(
        this.retryMode
      )})`
    )

    if (this.retryMode === SynapseAdminRetryMode.EXCLUSIVE) {
      this.logger.debug(
        `Using admin API exclusively for avatar update: ${userId}`
      )
      await this.#updateAvatarAdmin(userId, resolvedUrl)
      return
    }

    const intent = this.apis.getIntent(userId)

    try {
      this.logger.debug(`Attempting standard API avatar update for ${userId}`)
      await intent.setAvatarUrl(resolvedUrl)
      this.logger.info(`Updated avatar for ${userId} to "${resolvedUrl}"`)
    } catch (err: any) {
      this.logger.warn(
        `Failed to update avatar via standard API for ${userId}: ${
          err?.errcode || err?.message || 'Unknown error'
        }`
      )

      if (
        err?.errcode === 'M_FORBIDDEN' &&
        this.retryMode === SynapseAdminRetryMode.FALLBACK
      ) {
        this.logger.info(`Falling back to admin API for avatar ${userId}`)
        await this.#updateAvatarAdmin(userId, resolvedUrl)
      } else {
        this.logger.error(
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
    this.logger.debug(`Calling admin API to update avatar for ${userId}`)

    try {
      await this.apis.adminUpsertUser(userId, { avatar_url: avatarUrl })
      this.logger.info(
        `Updated avatar via admin API for ${userId} to "${avatarUrl}"`
      )
    } catch (error) {
      this.logger.error(
        `Admin API failed to update avatar for ${userId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      throw error
    }
  }

  /**
   * Processes setting changes between old and new payloads.
   * Detects changes in display name and avatar, then updates them in Matrix.
   * @param userId - The Matrix user ID
   * @param oldPayload - Previous settings payload (null if new user)
   * @param newPayload - New settings payload
   * @param isNewUser - Whether this is a new user (forces updates)
   */
  async processChanges(
    userId: string,
    oldPayload: SettingsPayload | null,
    newPayload: SettingsPayload,
    isNewUser: boolean
  ): Promise<void> {
    this.logger.debug(
      `Processing changes for ${userId} (isNewUser=${isNewUser})`
    )

    const displayNameChanged =
      isNewUser || oldPayload?.display_name !== newPayload.display_name
    const avatarChanged = isNewUser || oldPayload?.avatar !== newPayload.avatar

    this.logger.debug(
      `Change detection: displayName=${displayNameChanged} (old="${oldPayload?.display_name}", new="${newPayload.display_name}"), avatar=${avatarChanged} (old="${oldPayload?.avatar}", new="${newPayload.avatar}")`
    )

    if (displayNameChanged && newPayload.display_name) {
      this.logger.debug(`Display name change detected for ${userId}`)
      await this.updateDisplayName(userId, newPayload.display_name)
    } else if (displayNameChanged && !newPayload.display_name) {
      this.logger.warn(
        `Display name changed but new value is empty for ${userId}`
      )
    }

    if (avatarChanged && newPayload.avatar) {
      this.logger.debug(`Avatar change detected for ${userId}`)
      await this.updateAvatar(userId, newPayload.avatar)
    } else if (avatarChanged && !newPayload.avatar) {
      this.logger.warn(`Avatar changed but new value is empty for ${userId}`)
    }

    if (!displayNameChanged && !avatarChanged) {
      this.logger.debug(`No profile changes detected for ${userId}`)
    }
  }

  /**
   * Gets a human-readable name for the retry mode.
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
}
