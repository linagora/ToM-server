import { TwakeLogger } from '@twake-chat/logger'
import { DeleteUserMediaResponse, IAdminService } from '../types'
import { Config, ITokenService } from '../../types'
import TokenService from '../../utils/services/token-service'
import { buildUrl } from '../../utils'

export default class DeactivateAccountService implements IAdminService {
  private readonly device = 'deactivate_service'
  private readonly tokenService: ITokenService

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger,
    tokenService?: ITokenService
  ) {
    this.tokenService =
      tokenService ?? new TokenService(this.config, this.logger, this.device)
    this.logger.info('[DeactivateAccountService] Initialized.')
  }

  /**
   * Deactivates a user
   *
   * @param {string} userId - The ID of the user to deactivate
   * @returns {Promise<void>}
   */
  removeAccount = async (userId: string): Promise<void> => {
    try {
      const token = await this._getAdminAccessToken()

      if (!token) {
        throw new Error('Failed to get admin access token')
      }

      await this.deleteUserMedia(userId, token)
      await this.disableUserAccount(userId, token)
    } catch (error) {
      this.logger.error(
        `[DeactivateAccountService] Failed to deactivate user`,
        { error }
      )

      throw error
    }
  }

  /**
   * Deletes the user media
   *
   * @param {string} userId - The ID of the user whose media should be deleted
   * @param {string} token - The access token to be used for authentication
   * @returns {Promise<void>}
   */
  public deleteUserMedia = async (
    userId: string,
    token: string
  ): Promise<void> => {
    try {
      const response = await fetch(
        buildUrl(
          this.config.matrix_server,
          `/_synapse/admin/v1/users/${userId}/media`
        ),
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      const data = (await response.json()) as DeleteUserMediaResponse

      if (!data || data.total === undefined) {
        throw new Error()
      }

      this.logger.info(
        `[DeactivateAccountService] Deleted ${data.total} media files for user ${userId}`
      )
    } catch (error) {
      this.logger.error(
        `[DeactivateAccountService] Failed to delete user media`,
        { error }
      )
    }
  }

  /**
   * Deactivate user account in matrix server
   *
   * @param {string} userId - The ID of the user to deactivate
   * @param {string} token - The access token to be used for authentication
   * @returns {Promise<void>}
   */
  public disableUserAccount = async (
    userId: string,
    token: string
  ): Promise<void> => {
    try {
      await fetch(
        buildUrl(
          this.config.matrix_server,
          `/_synapse/admin/v1/deactivate/${userId}`
        ),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            erase: true
          })
        }
      )

      this.logger.info(
        `[DeactivateAccountService] Disabled user account ${userId}`
      )
    } catch (error) {
      this.logger.error(
        `[DeactivateAccountService] Failed to disable user account`,
        {
          error
        }
      )

      throw new Error('Failed to deactivate user', { cause: error })
    }
  }

  /**
   * Gets the admin access token
   *
   * @returns {Promise<string | null>} The admin access token or null if an error occurs
   */
  private _getAdminAccessToken = async (): Promise<string | null> => {
    try {
      const accessToken = await this.tokenService.getAccessTokenWithCreds(
        this.config.matrix_admin_login,
        this.config.matrix_admin_password
      )

      if (!accessToken) {
        throw new Error('Failed to get access token')
      }

      return accessToken
    } catch (error) {
      this.logger.error(
        `[DeactivateAccountService] Failed to get access token`,
        { error }
      )

      throw error
    }
  }
}
