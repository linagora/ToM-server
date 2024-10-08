import { type TwakeLogger } from '@twake/logger'
import { type Config } from '../../types'
import {
  type TokenLoginPayload,
  type IQRCodeTokenService,
  type TokenLoginResponse,
  type loginFlowsResponse,
  type OIDCRedirectResponse
} from '../types'

export class QRCodeTokenService implements IQRCodeTokenService {
  JSON_HEADERS = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }

  matrixUrl: string

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {
    this.matrixUrl = `https://${this.config.matrix_server}/_matrix/client/v3`
  }

  getAccessToken = async (authCookies: string): Promise<string | null> => {
    try {
      const provider = await this.getOidcProvider()

      if (provider === null) {
        throw new Error('Failed to get OIDC provider')
      }

      const redirectionResponse = await this.getOidcRedirectLocation(provider)

      if (redirectionResponse === null) {
        throw new Error('Failed to get OIDC redirect location')
      }

      const { cookies, location } = redirectionResponse

      const loginToken = await this.getLoginToken(
        location,
        cookies,
        authCookies
      )

      if (loginToken === null) {
        throw new Error('Failed to get login token')
      }

      const accessToken = await this.requestAccessToken(loginToken)

      if (accessToken === null) {
        throw new Error('Failed to get access token')
      }

      return accessToken
    } catch (error) {
      this.logger.error('Failed to fetch access_token', { error })
      return null
    }
  }

  /**
   * Fetches the access token from the Matrix server using the provided login token.
   *
   * @param {string} loginToken - The login token to be used for authentication.
   * @returns {Promise<string | null>} The access token or null if an error occurs.
   */
  requestAccessToken = async (loginToken: string): Promise<string | null> => {
    try {
      const response = await fetch(`${this.matrixUrl}/login`, {
        method: 'POST',
        headers: this.JSON_HEADERS,
        body: JSON.stringify({
          token: loginToken,
          type: 'm.login.token',
          initial_device_display_name: 'QR Code Login'
        } satisfies TokenLoginPayload)
      })

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

  /**
   * Fetches the OIDC provider from the Matrix server.
   *
   * @returns {Promise<string | null>} The OIDC provider or null if an error occurs.
   */
  getOidcProvider = async (): Promise<string | null> => {
    try {
      const response = await fetch(`${this.matrixUrl}/login`, {
        method: 'GET',
        headers: this.JSON_HEADERS
      })

      const data = (await response.json()) as loginFlowsResponse

      if (data.error !== undefined || data.flows.length < 1) {
        throw new Error('No OIDC provider found in the response', {
          cause: data.error
        })
      }

      const oidcProvider = data.flows.find(
        (flow) =>
          flow.type === 'm.login.sso' && flow.identity_providers !== undefined
      )

      if (
        oidcProvider === undefined ||
        oidcProvider.identity_providers === undefined
      ) {
        throw new Error('No OIDC provider found in the response')
      }

      return oidcProvider.identity_providers[0].id
    } catch (error) {
      this.logger.error('Failed to fetch OIDC login provider', { error })

      return null
    }
  }

  /**
   * Retrieves the OIDC redirect location and session cookies from the Matrix server.
   *
   * @param {string} oidcProvider - The OIDC provider to use for the redirect.
   * @returns {Promise<OIDCRedirectResponse | null>} The OIDC redirect location and cookies or null if an error occurs.
   */
  getOidcRedirectLocation = async (
    oidcProvider: string
  ): Promise<OIDCRedirectResponse | null> => {
    try {
      const response = await fetch(
        `${this.matrixUrl}/login/sso/redirect/${oidcProvider}?redirectUrl=http://localhost:9876`,
        {
          method: 'GET',
          headers: this.JSON_HEADERS,
          redirect: 'manual'
        }
      )

      const location = response.headers.get('location')
      const cookies = response.headers.get('set-cookie')

      if (location === null) {
        throw new Error('No location found in the response')
      }

      if (cookies === null) {
        throw new Error('No session cookies found in the response')
      }

      return { location, cookies }
    } catch (error) {
      this.logger.error('Failed to fetch access_token', { error })
      return null
    }
  }

  /**
   * Fetches the login token using SSO
   *
   * @param {string} location - The location to fetch the login token from.
   * @param {string} sessionCookies - The session cookies to be used for authentication.
   * @param {string} authCookie - The auth cookie to be used for authentication ( ex lemonldap ).
   * @returns {Promise<string | null>} The login token or null if an error occurs.
   * @memberof QRCodeTokenService
   * @example
   * const loginToken = await getLoginToken(location, sessionCookies, authCookie);
   */
  getLoginToken = async (
    location: string,
    sessionCookies: string,
    authCookie: string
  ): Promise<string | null> => {
    try {
      const response = await fetch(location, {
        headers: {
          Cookie: `${sessionCookies}; ${authCookie}`
        }
      })

      const responseText = await response.text()
      const loginTokenMatch = responseText.match(/loginToken=(.+?)['"]/)

      if (loginTokenMatch === null) {
        throw new Error('No LoginToken found in the response')
      }

      if (loginTokenMatch[1] === undefined) {
        throw new Error('invalid LoginToken')
      }

      return loginTokenMatch[1]
    } catch (error) {
      this.logger.error('Failed to fetch LoginToken', { error })
      return null
    }
  }
}
