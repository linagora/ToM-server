import { type TwakeLogger } from '@twake/logger'
import { ITokenService, TokenResponse, type Config } from '../../types'
import {
  type TokenLoginPayload,
  type TokenLoginResponse,
  type loginFlowsResponse,
  type OIDCRedirectResponse
} from '../../types'

export default class TokenService implements ITokenService {
  JSON_HEADERS = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }

  ACCEPT_JSON = {
    Accept: 'application/json'
  }

  private matrixUrl: string
  private authProviderUrl: string

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger,
    private readonly device: string
  ) {
    this.matrixUrl = `https://${this.config.matrix_server}/_matrix/client/v3`

    if (!this.config.auth_url) {
      this.logger.warn(
        '[TokenService] No auth_url provided in the configuration, using default value'
      )
    }

    this.authProviderUrl = this.config.auth_url as string
    this.logger.info('[TokenService] Initialized.', {})
  }

  /**
   * Fetches the access token from the Matrix server using the auth cookies.
   *
   * @param {string} authCookies - The authentication cookies to be used for authentication.
   * @returns {Promise<string | null>} The access token or null if an error occurs.
   */
  getAccessTokenWithCookie = async (
    authCookies: string
  ): Promise<string | null> => {
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
      this.logger.error('[TokenService] Failed to fetch access_token', {
        error
      })
      return null
    }
  }

  /**
   * Fetches the access token from the Matrix server using the provided username and password.
   *
   * @param {string} username - The username to be used for authentication.
   * @param {string} password - The password to be used for authentication.
   * @returns {Promise<string | null>} The access token or null if an error occurs.
   */
  getAccessTokenWithCreds = async (
    username: string,
    password: string
  ): Promise<string | null> => {
    try {
      const cookie = await this.getAuthCookie(username, password)

      if (!cookie) {
        this.logger.error('Failed to get auth cookie from auth provider')
        throw new Error('Failed to get auth cookie')
      }

      const token = await this.getAccessTokenWithCookie(cookie)

      if (!token) {
        this.logger.error(
          'Failed to get access token using auth provider cookie'
        )
        throw new Error('Failed to get access token')
      }

      return token
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
          initial_device_display_name: this.device
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
      const cookies = this.extractCookies(response)

      if (location === null) {
        throw new Error('No location found in the response')
      }

      if (cookies.length === 0) {
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
   * The redirect chain crosses origins (auth provider → Matrix), so we must
   * handle redirects manually to send the right cookies to each server.
   * Node.js fetch strips cookies on cross-origin redirects.
   *
   * @param {string} location - The auth provider URL to initiate the login flow.
   * @param {string} sessionCookies - The Matrix session cookies for the OIDC callback.
   * @param {string} authCookie - The auth cookie for the auth provider (e.g. lemonldap).
   * @returns {Promise<string | null>} The login token or null if an error occurs.
   */
  getLoginToken = async (
    location: string,
    sessionCookies: string,
    authCookie: string
  ): Promise<string | null> => {
    try {
      // Step 1: Visit auth provider with auth cookie only (manual redirect)
      const authResponse = await fetch(location, {
        headers: {
          Cookie: authCookie
        },
        redirect: 'manual'
      })

      const callbackUrl = authResponse.headers.get('location')
      await authResponse.body?.cancel()

      if (callbackUrl === null) {
        throw new Error('No callback URL in auth provider response')
      }

      const matrixOrigin = new URL(this.matrixUrl).origin

      if (new URL(callbackUrl).origin !== matrixOrigin) {
        throw new Error('Unexpected callback origin: expected Matrix server')
      }

      // Step 2: Follow callback to Matrix with session cookies
      const callbackResponse = await fetch(callbackUrl, {
        headers: {
          Cookie: sessionCookies
        },
        redirect: 'manual'
      })

      // Check redirect URL (Synapse may redirect to redirectUrl?loginToken=xxx)
      const redirectLocation = callbackResponse.headers.get('location')

      if (redirectLocation !== null) {
        const url = new URL(redirectLocation)
        const loginToken = url.searchParams.get('loginToken')

        if (loginToken !== null) {
          await callbackResponse.body?.cancel()
          return loginToken
        }
      }

      // Check body (Synapse may return HTML with embedded loginToken)
      const responseText = await callbackResponse.text()
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

  /**
   * Fetches the auth cookie from the LemonLDAP server using the provided username and password.
   *
   * @param {string} login - The username to be used for authentication.
   * @param {string} password - The password to be used for authentication.
   * @returns {Promise<string | null>} The auth cookie or null if an error occurs.
   */
  getAuthCookie = async (
    user: string,
    password: string
  ): Promise<string | null> => {
    try {
      const token = await this._getAuthProviderLoginToken()

      if (!token) {
        throw new Error('Failed to get login token from auth provider')
      }

      const response = await fetch(this.authProviderUrl, {
        method: 'POST',
        headers: this.ACCEPT_JSON,
        body: new URLSearchParams({ user, password, token })
      })

      const cookie = this.extractCookies(response)

      if (cookie.length === 0) {
        throw new Error('No auth cookie found in the response')
      }

      return cookie
    } catch (error) {
      this.logger.error('Failed to fetch auth cookie', { error })
      return null
    }
  }

  /**
   * Extracts cookie name=value pairs from a response's Set-Cookie headers.
   * Strips cookie attributes (Domain, Path, HttpOnly, etc.) and joins
   * multiple cookies with '; ' for use in a Cookie request header.
   */
  private extractCookies = (response: Response): string => {
    return response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0].trim())
      .filter((cookie) => cookie.length > 0)
      .join('; ')
  }

  /**
   * Fetches the login token from the auth provider.
   *
   * @returns {Promise<string | null>} The login token or null if an error occurs.
   */
  private _getAuthProviderLoginToken = async (): Promise<string | null> => {
    try {
      const response = await fetch(this.authProviderUrl, {
        headers: this.JSON_HEADERS
      })

      const { token } = (await response.json()) as TokenResponse

      if (token === undefined) {
        throw new Error('No token found in the response')
      }

      return token
    } catch (error) {
      this.logger.error('Failed to fetch the login from auth provider', {
        error
      })

      return null
    }
  }
}
