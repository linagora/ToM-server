import { type TwakeLogger } from '@twake/logger'
import { type Config } from '../../types'
import { type ITokenService } from '../../types'
import TokenService from '../../utils/services/token-service'
import {
  type UploadUserAvatarResponse,
  type UserInformationPayload,
  type IAdminSettingsService,
  IAdminTokenManager,
  REQUEST_TOKEN_RETRY_CONFIG
} from '../types'
import { buildUrl } from '../../utils'
import AdminTokenManager from './admin-token-manager'

export default class AdminSettingsService implements IAdminSettingsService {
  private readonly device = 'admin_service'
  private readonly tokenService: ITokenService
  private readonly tokenManager: AdminTokenManager

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger,
    tokenService?: ITokenService,
    tokenManager?: IAdminTokenManager
  ) {
    this.tokenService =
      tokenService ?? new TokenService(this.config, this.logger, this.device)

    // Create AdminTokenManager with request-level retry config (bounded retries)
    this.tokenManager =
      (tokenManager as AdminTokenManager) ??
      new AdminTokenManager(
        this.config,
        this.logger,
        this.tokenService,
        REQUEST_TOKEN_RETRY_CONFIG
      )
    this.logger.info('[AdminSettingsService] Initialized.')
  }

  getTokenManager(): IAdminTokenManager {
    return this.tokenManager
  }

  cleanup(): void {
    this.tokenManager.stopTokenAcquisition()
  }

  /**
   * Updates the display name of a user
   *
   * @param userId - The ID of the user to update
   * @param newDisplayName - The new display name for the user
   */
  updateUserInformation = async (
    userId: string,
    payload: UserInformationPayload
  ): Promise<void> => {
    const { displayName, avatarUrl } = payload
    let avatarMxc: string | null = null

    // If present, upload the avatar image to the media repository
    // and get the mxc URL
    if (avatarUrl != null) {
      avatarMxc = await this._fetchAndUploadAvatar(avatarUrl)
    }

    // Make the profile update request if we have a display name or an avatar or both
    const updatePayload: Record<string, string> = {}

    if (displayName != null) {
      updatePayload.displayname = displayName ?? ''
    }
    if (avatarMxc != null) {
      updatePayload.avatar_url = avatarMxc
    }

    if (Object.keys(updatePayload).length > 0) {
      this.logger.info(`Updating user ${userId} profile with`, updatePayload)

      const response = await this.makeRequestWithAdminToken(
        buildUrl(
          this.config.matrix_server,
          `/_synapse/admin/v2/users/${userId}`
        ),
        {
          method: 'PUT',
          body: JSON.stringify(updatePayload)
        }
      )

      const data = await response.json()
      if (!response.ok) {
        this.logger.error(`Failed to update profile for ${userId}`, {
          status: response.status,
          data
        })
        throw new Error(
          `Failed to update profile: ${response.status} ${response.statusText}`
        )
      }

      this.logger.info(`Successfully updated profile for user ${userId}`)
    }
  }

  /**
   * Private helper: fetches an image from a URL and uploads it to the Synapse media repo
   * @param avatarUrl - The URL of the avatar image to fetch
   * @param token - The admin access token
   * @returns The mxc URL of the uploaded image, or null if upload failed
   */
  private readonly _fetchAndUploadAvatar = async (
    avatarUrl: string
  ): Promise<string | null> => {
    try {
      this.logger.info(`Fetching avatar image from ${avatarUrl}`)
      const url = new URL(avatarUrl)
      url.searchParams.set('format', 'png')
      url.searchParams.set('fallback', 'initials')
      const resp = await fetch(url.toString())
      if (!resp.ok)
        throw new Error(
          `Failed to fetch avatar: ${resp.status} ${resp.statusText}`
        )

      const buffer = Buffer.from(await resp.arrayBuffer())
      const uploadUrl = `https://${this.config.matrix_server}/_matrix/media/v3/upload?filename=avatar.png`
      const uploadResp = await this.makeRequestWithAdminToken(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'image/png'
        },
        body: buffer
      })

      if (!uploadResp.ok)
        throw new Error(
          `Upload failed: ${uploadResp.status} ${uploadResp.statusText}`
        )

      const uploadResult = (await uploadResp.json()) as UploadUserAvatarResponse
      const avatarMxc = uploadResult.content_uri ?? null
      this.logger.info(
        `Avatar upload success: ${avatarMxc ?? 'no mxc returned'}`
      )

      return avatarMxc
    } catch (err) {
      this.logger.error('Avatar upload failed', { error: err })
      throw err
    }
  }

  /**
   * Makes a request to the Matrix server with the admin access token
   *
   * @param endpoint - The Matrix server endpoint to call
   * @param options - The fetch options (method, headers, body, etc.)
   * @param maxRetries  - The maximum number of retries on 401 Unauthorized responses
   * @returns {Promise<Response>} The fetch response
   */
  public async makeRequestWithAdminToken(
    endpoint: string,
    options: RequestInit = {},
    maxRetries = 1
  ): Promise<Response> {
    let attempt = 0
    while (attempt <= maxRetries) {
      const token = await this.tokenManager.getToken()
      const response = await this._doFetch(endpoint, options, token)

      if (response.status === 401 && attempt < maxRetries) {
        this.logger.warn(
          `Received 401 Unauthorized (attempt ${attempt + 1}), refreshing token`
        )
        this._invalidateToken()
        attempt++
        continue
      }

      if (response.status === 401) {
        throw new Error(
          `Admin API request failed after ${
            attempt + 1
          } attempts due to 401 Unauthorized`
        )
      }

      return response
    }

    // This should never be reached, but TypeScript needs it
    throw new Error(`Admin API request failed after ${maxRetries + 1} attempts`)
  }

  /** * Performs a fetch request to the Matrix server with the given endpoint and options
   *
   * @param endpoint - The Matrix server endpoint to call
   * @param options - The fetch options (method, headers, body, etc.)
   * @param token - The admin access token for authorization
   * @returns {Promise<Response>} The fetch response
   */
  private async _doFetch(
    endpoint: string,
    options: RequestInit,
    token: string
  ): Promise<Response> {
    const url = buildUrl(this.config.matrix_server, endpoint)
    const headers = {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`
    }
    return await fetch(url, { ...options, headers })
  }

  private _invalidateToken(): void {
    this.logger.warn('Invalidating cached admin token')
    this.tokenManager.invalidateToken()
  }

  private async _getCachedToken(): Promise<string> {
    return await this.tokenManager.getToken()
  }
}
