import { type TwakeLogger } from '@twake/logger'
import { type Config, type ITokenService } from '../../types'
import TokenService from '../../utils/services/token-service'
import { type IAdminSettingsService } from '../types'
import { buildUrl } from '../../utils'

export default class AdminService implements IAdminSettingsService {
  private readonly device = 'admin service'
  private readonly tokenService: ITokenService

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {
    this.tokenService = new TokenService(this.config, this.logger, this.device)
  }

  /**
   * Updates the display name of a user
   *
   * @param userId - The ID of the user to update
   * @param newDisplayName - The new display name for the user
   */
  updateDisplayName = async (
    userId: string,
    newDisplayName: string,
  ): Promise<void> => {
    const token = await this._getAdminAccessToken();
    if (token == null) {
      throw new Error('Failed to get admin access token')
    }

    // make API call to update display name
    this.logger.info(`Updating display name for user ${userId} to ${newDisplayName} using token: ${token}`);
    // Example: await someApi.updateUserDisplayName(userId, newDisplayName, token);
    const response = await fetch(
      buildUrl(
        this.config.matrix_server,
        `/_synapse/admin/v2/users/${userId}`
      ),
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          displayname: newDisplayName
        })
      }
    )

    const data = (await response.json()) as any;
    if (!response.ok) {
      this.logger.error(`Failed to update display name for user ${userId}`, { status: response.status, data })
      throw new Error(`Failed to update display name: ${response.status} ${response.statusText}`)
    }

    this.logger.info(`Successfully updated display name for user ${userId}`)
  };

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
}
