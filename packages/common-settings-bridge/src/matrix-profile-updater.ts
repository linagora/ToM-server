import { type Logger, type Intent } from 'matrix-appservice-bridge'
import { SynapseAdminRetryMode, type SettingsPayload } from './types'
import { AvatarFetchError } from './types'

/**
 * Default maximum allowed avatar file size (5MB).
 * Prevents memory exhaustion from malicious or oversized external URLs.
 */
export const DEFAULT_MAX_AVATAR_BYTES = 5 * 1024 * 1024

/**
 * Default timeout for fetching external avatar URLs (10 seconds).
 * Prevents indefinite hangs on slow or unresponsive servers.
 */
export const DEFAULT_AVATAR_FETCH_TIMEOUT_MS = 10_000

/**
 * Configuration for avatar upload behavior.
 */
export interface AvatarConfig {
  readonly maxSizeBytes: number
  readonly fetchTimeoutMs: number
}

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

  /**
   * Uploads content to Matrix using the bot's credentials.
   * Used when the bot cannot masquerade as the target user.
   * @param content - The content buffer to upload
   * @param contentType - MIME type of the content
   * @param fileName - Optional file name
   * @returns The MXC URL of the uploaded content
   */
  botUploadContent(
    content: Buffer,
    contentType: string,
    fileName?: string
  ): Promise<string>
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
    private readonly logger: Logger,
    private readonly avatarConfig: AvatarConfig = {
      maxSizeBytes: DEFAULT_MAX_AVATAR_BYTES,
      fetchTimeoutMs: DEFAULT_AVATAR_FETCH_TIMEOUT_MS
    }
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
      `Updating display name for ${userId} (retryMode=${this.retryMode})`
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
        (err?.errcode === 'M_FORBIDDEN' || err?.errcode === 'M_EXCLUSIVE') &&
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
   * Downloads an avatar from an external URL and returns the buffer and content type.
   * @param userId - The Matrix user ID (for logging)
   * @param avatarUrl - The HTTP(S) URL to download from
   * @returns Object containing the buffer and content type
   * @throws {AvatarFetchError} If download times out, exceeds size limit, or HTTP error
   */
  async #downloadAvatar(
    userId: string,
    avatarUrl: string
  ): Promise<{ buffer: Buffer; contentType: string }> {
    this.logger.info(
      `Downloading avatar from external URL for ${userId}: ${avatarUrl}`
    )

    const controller = new AbortController()
    // Validate and sanitize timeout value to prevent DoS attacks
    // Ensures timeout is a positive finite number within reasonable bounds
    const timeoutMs = Math.max(
      1000, // Minimum 1 second
      Math.min(
        60_000, // Maximum 60 seconds
        Number(this.avatarConfig.fetchTimeoutMs) ||
          DEFAULT_AVATAR_FETCH_TIMEOUT_MS
      )
    )
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(avatarUrl, { signal: controller.signal })
      clearTimeout(timeout)

      if (!response.ok) {
        throw new AvatarFetchError(
          `HTTP ${response.status}: ${response.statusText}`
        )
      }

      // Pre-check content-length header if available
      const contentLength = Number(response.headers.get('content-length') || 0)
      if (contentLength > this.avatarConfig.maxSizeBytes) {
        throw new AvatarFetchError(
          `Avatar too large: ${contentLength} bytes (max ${this.avatarConfig.maxSizeBytes})`
        )
      }

      const contentType = response.headers.get('content-type') ?? 'image/png'

      // Download and validate actual size
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      if (buffer.length > this.avatarConfig.maxSizeBytes) {
        throw new AvatarFetchError(
          `Avatar too large: ${buffer.length} bytes (max ${this.avatarConfig.maxSizeBytes})`
        )
      }

      this.logger.debug(
        `Downloaded avatar for ${userId}: ${buffer.length} bytes, type=${contentType}`
      )

      return { buffer, contentType }
    } catch (error) {
      clearTimeout(timeout)

      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new AvatarFetchError(
          `Avatar fetch timed out after ${timeoutMs}ms`
        )
        this.logger.error(
          `Failed to download avatar for ${userId} from ${avatarUrl}: ${timeoutError.message}`
        )
        throw timeoutError
      }

      this.logger.error(
        `Failed to download avatar for ${userId} from ${avatarUrl}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      throw error
    }
  }

  /**
   * Resolves an avatar URL to an MXC URL.
   * If the URL is already an MXC URL, returns it as-is.
   * If the URL is an HTTP/HTTPS URL, downloads with timeout and size validation,
   * then uploads it to Synapse using appropriate credentials based on retry mode.
   * @param userId - The Matrix user ID (used for logging and intent)
   * @param avatarUrl - The avatar URL to resolve (can be mxc:// or http(s)://)
   * @returns The MXC URL for the avatar
   * @throws {AvatarFetchError} If download times out, exceeds size limit, or HTTP error
   */
  async #resolveAvatarUrl(userId: string, avatarUrl: string): Promise<string> {
    if (avatarUrl.startsWith('mxc://')) {
      this.logger.debug(`Avatar URL is already MXC format: ${avatarUrl}`)
      return avatarUrl
    }

    // Download the avatar first
    const { buffer, contentType } = await this.#downloadAvatar(
      userId,
      avatarUrl
    )

    // In EXCLUSIVE mode, always upload using bot credentials
    if (this.retryMode === SynapseAdminRetryMode.EXCLUSIVE) {
      this.logger.debug(
        `Using bot credentials for avatar upload (exclusive mode): ${userId}`
      )
      const mxcUrl = await this.apis.botUploadContent(
        buffer,
        contentType,
        'avatar'
      )
      this.logger.info(`Uploaded avatar via bot for ${userId}: ${mxcUrl}`)
      return mxcUrl
    }

    // Try uploading as the user first
    try {
      this.logger.debug(`Attempting avatar upload as user: ${userId}`)
      const intent = this.apis.getIntent(userId)
      const mxcUrl = await intent.matrixClient.uploadContent(
        buffer,
        contentType,
        'avatar'
      )
      this.logger.info(`Uploaded avatar to Synapse for ${userId}: ${mxcUrl}`)
      return mxcUrl
    } catch (error: any) {
      // In FALLBACK mode, try bot upload on M_FORBIDDEN
      if (
        (error?.errcode === 'M_FORBIDDEN' ||
          error?.errcode === 'M_EXCLUSIVE') &&
        this.retryMode === SynapseAdminRetryMode.FALLBACK
      ) {
        this.logger.info(
          `Falling back to bot credentials for avatar upload: ${userId}`
        )
        const mxcUrl = await this.apis.botUploadContent(
          buffer,
          contentType,
          'avatar'
        )
        this.logger.info(`Uploaded avatar via bot for ${userId}: ${mxcUrl}`)
        return mxcUrl
      }

      this.logger.error(
        `Failed to upload avatar for ${userId}: ${
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
      `Updating avatar for ${userId} (retryMode=${this.retryMode})`
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
        (err?.errcode === 'M_FORBIDDEN' || err?.errcode === 'M_EXCLUSIVE') &&
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
    newPayload: SettingsPayload
  ): Promise<void> {
    this.logger.debug(`Processing changes for ${userId}`)

    const displayNameChanged =
      oldPayload?.display_name !== newPayload.display_name
    const avatarChanged = oldPayload?.avatar !== newPayload.avatar

    this.logger.debug(
      `Change detection: displayName=${displayNameChanged} (old="${oldPayload?.display_name}", new="${newPayload.display_name}"), avatar=${avatarChanged} (old="${oldPayload?.avatar}", new="${newPayload.avatar}")`
    )

    if (!displayNameChanged && !avatarChanged) {
      this.logger.debug(`No profile changes detected for ${userId}`)
      return
    }

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
  }
}
