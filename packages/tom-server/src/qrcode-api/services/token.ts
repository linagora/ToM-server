import { type TwakeLogger } from '@twake/logger'
import { type Config } from '../../types'
import {
  type TokenLoginPayload,
  type IQRCodeTokenService,
  type TokenLoginResponse
} from '../types'

export class QRCodeTokenService implements IQRCodeTokenService {
  JSON_HEADERS = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {}

  /**
   * Fetches the access token from the Matrix server using the provided login token.
   *
   * @param {string} loginToken - The login token to be used for authentication.
   * @returns {Promise<string | null>} The access token or null if an error occurs.
   */
  getAccessToken = async (loginToken: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `${this.config.matrix_server}/_matrix/client/v3/login`,
        {
          method: 'POST',
          headers: this.JSON_HEADERS,
          body: JSON.stringify({
            token: loginToken,
            type: 'm.login.token',
            initial_device_display_name: 'QR Code Login'
          } satisfies TokenLoginPayload)
        }
      )

      const data = (await response.json()) as TokenLoginResponse

      if (data.error !== undefined || data.access_token === undefined) {
        throw new Error('No access_token found in the response')
      }

      return data.access_token
    } catch (error) {
      this.logger.error('Failed to fetch access_token', { error })
      return null
    }
  }
}
