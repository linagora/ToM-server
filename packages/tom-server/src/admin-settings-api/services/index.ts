import fetch, { type Response, RequestInit } from 'node-fetch'
import { type TwakeLogger } from '@twake-chat/logger'
import { type Config, type ITokenService } from '../../types.ts'
import TokenService from '../../utils/services/token-service.ts'
import {
  type UploadUserAvatarResponse,
  type UserInformationPayload,
  type IAdminSettingsService
} from '../types.ts'
import { Lru } from 'toad-cache'
import { buildUrl } from '../../utils.ts'
export default class AdminSettingsService implements IAdminSettingsService {
  private readonly device = 'admin_service'
  private readonly tokenService: ITokenService
  private readonly cache = new Lru<string>(1, 0)
  private readonly TOKEN_KEY = 'admin_token'

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger,
    tokenService?: ITokenService
  ) {
    this.tokenService =
      tokenService ?? new TokenService(this.config, this.logger, this.device)
    this.logger.info('[AdminSettingsService] Initialized.')
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

    while (true) {
      const token = await this._getCachedToken()
      const response = await this._doFetch(endpoint, options, token)
      if (response.status !== 401) {
        return response
      }

      if (attempt >= maxRetries) {
        throw new Error(
          `Request to ${endpoint} failed after ${
            attempt + 1
          } attempts (status: ${response.status})`
        )
      }

      this.logger.warn(
        `Received 401 Unauthorized (attempt ${
          attempt + 1
        }). Refreshing token and retrying…`
      )
      this._invalidateToken()
      attempt++
    }
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

  /**
   * Gets the admin access token
   *
   * @returns {Promise<string | null>} The admin access token or null if an error occurs
   */
  private readonly _getAdminAccessToken = async (): Promise<string | null> => {
    try {
      const accessToken = await this.tokenService.getAccessTokenWithCreds(
        this.config.matrix_admin_login,
        this.config.matrix_admin_password
      )

      if (accessToken == null) {
        throw new Error('Failed to get access token')
      }

      return accessToken
    } catch (error) {
      this.logger.error(`Failed to get access token`, { error })

      throw error
    }
  }

  /**
   * Invalidates the cached admin token
   *
   * @returns {void}
   */
  private _invalidateToken(): void {
    this.logger.warn('Invalidating cached admin token')
    this.cache.delete(this.TOKEN_KEY)
  }

  /**
   * Gets the cached admin token, or fetches a new one if not cached
   *
   * @returns {Promise<string>} The admin access token
   */
  private async _getCachedToken(): Promise<string> {
    let token = this.cache.get(this.TOKEN_KEY)

    if (token == null) {
      const newToken = await this._getAdminAccessToken()
      if (newToken == null) {
        throw new Error('Failed to fetch admin access token')
      }

      this.cache.set(this.TOKEN_KEY, newToken)
      this.logger.info(`Cached new admin token`)

      token = newToken
    }

    return token
  }
}
