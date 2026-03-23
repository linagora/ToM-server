import { type TwakeLogger } from '@twake/logger'
import { type Config } from '../../types'
import TokenService from './token-service'
import type { LoginFlow } from '../../types'

global.fetch = jest.fn(
  async () =>
    await Promise.resolve({
      json: async () => await Promise.resolve({ access_token: 'demo_token' })
    } as unknown as Response)
)

describe('the Token service', () => {
  const loggerMock = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }

  const configMock = {
    matrix_server: 'example.com',
    auth_url: 'https://auth.example.com'
  } as unknown as Config

  const tokenService = new TokenService(
    configMock,
    loggerMock as unknown as TwakeLogger,
    'test'
  )

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('the getOidcProvider method', () => {
    it('should return the oidc provider', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            json: async () =>
              await Promise.resolve({
                flows: [
                  {
                    type: 'm.login.sso',
                    identity_providers: [
                      { id: 'test-oidc-provider', name: 'test oidc provider' }
                    ]
                  },
                  {
                    type: 'm.login.token'
                  }
                ] satisfies LoginFlow[]
              })
          } as unknown as Response)
      )
      const result = await tokenService.getOidcProvider()

      expect(result).toBe('test-oidc-provider')
    })

    it('should return null if no oidc provider is found', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            json: async () =>
              await Promise.resolve({
                flows: [
                  {
                    type: 'm.login.token'
                  }
                ] satisfies LoginFlow[]
              })
          } as unknown as Response)
      )
      const result = await tokenService.getOidcProvider()

      expect(result).toBeNull()
    })

    it("should return null if the sso login flow doesn't have any providers", async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            json: async () =>
              await Promise.resolve({
                flows: [
                  {
                    type: 'm.login.sso'
                  }
                ] satisfies LoginFlow[]
              })
          } as unknown as Response)
      )

      const result = await tokenService.getOidcProvider()
      expect(result).toBeNull()
    })

    it('should return null if the response had an error', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            json: async () =>
              await Promise.resolve({
                error: 'something unusual'
              })
          } as unknown as Response)
      )
      const result = await tokenService.getOidcProvider()

      expect(result).toBeNull()
    })

    it('should return null if something wrong happens while fetching', async () => {
      global.fetch = jest.fn(
        async () => await Promise.reject(new Error('API is down'))
      )
      const result = await tokenService.getOidcProvider()

      expect(result).toBeNull()
    })
  })

  describe('the getOidcRedirectLocation method', () => {
    it('should return the location and cleaned cookies from the redirection response', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            headers: {
              get: (header: string) => {
                if (header === 'location') {
                  return 'https://auth.example.com/login'
                }
                return null
              },
              getSetCookie: () => [
                'session=abc123; Path=/; HttpOnly; Secure',
                'session_compat=abc123; Path=/; HttpOnly'
              ]
            }
          } as unknown as Response)
      )

      const result = await tokenService.getOidcRedirectLocation('oidc_provider')

      expect(result).toEqual({
        location: 'https://auth.example.com/login',
        cookies: 'session=abc123; session_compat=abc123'
      })
    })

    it('should strip cookie attributes and handle a single cookie', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            headers: {
              get: (header: string) => {
                if (header === 'location') {
                  return 'https://auth.example.com/login'
                }
                return null
              },
              getSetCookie: () => [
                'token=abc=def==; Domain=.example.com; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=None'
              ]
            }
          } as unknown as Response)
      )

      const result = await tokenService.getOidcRedirectLocation('oidc_provider')

      expect(result).toEqual({
        location: 'https://auth.example.com/login',
        cookies: 'token=abc=def=='
      })
    })

    it('should return null if something wrong happens', async () => {
      global.fetch = jest.fn(
        async () => await Promise.reject(new Error('API is down'))
      )

      const result = await tokenService.getOidcRedirectLocation('oidc_provider')

      expect(result).toBeNull()
    })

    it('should return null if session cookies were missing from the headers', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            headers: {
              get: (header: string) => {
                if (header === 'location') {
                  return 'https://auth.example.com/login'
                }
                return null
              },
              getSetCookie: () => []
            }
          } as unknown as Response)
      )

      const result = await tokenService.getOidcRedirectLocation('oidc_provider')

      expect(result).toBeNull()
    })

    it('should return null if location header was missing', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            headers: {
              get: () => null,
              getSetCookie: () => ['session=abc123; Path=/; HttpOnly']
            }
          } as unknown as Response)
      )

      const result = await tokenService.getOidcRedirectLocation('oidc_provider')

      expect(result).toBeNull()
    })
  })

  describe('the getLoginToken method', () => {
    it('should extract the login token from the callback response body', async () => {
      global.fetch = jest
        .fn()
        // Step 1: auth provider returns redirect to Matrix callback
        .mockResolvedValueOnce({
          headers: {
            get: (header: string) =>
              header === 'location'
                ? 'https://example.com/_synapse/client/oidc/callback?code=abc&state=xyz'
                : null
          }
        } as unknown as Response)
        // Step 2: Matrix callback returns HTML with loginToken
        .mockResolvedValueOnce({
          headers: { get: () => null },
          text: async () =>
            '<a href="https://localhost:9876/?loginToken=123456">continue</a>'
        } as unknown as Response)

      const result = await tokenService.getLoginToken(
        'https://auth.example.com/authorize',
        'session=abc123',
        'lemonldap=xyz'
      )

      expect(result).toBe('123456')
      // Step 1: only auth cookie sent to auth provider
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        'https://auth.example.com/authorize',
        { headers: { Cookie: 'lemonldap=xyz' }, redirect: 'manual' }
      )
      // Step 2: only session cookies sent to Matrix callback
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://example.com/_synapse/client/oidc/callback?code=abc&state=xyz',
        { headers: { Cookie: 'session=abc123' }, redirect: 'manual' }
      )
    })

    it('should extract the login token from the callback redirect URL', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          headers: {
            get: (header: string) =>
              header === 'location'
                ? 'https://example.com/_synapse/client/oidc/callback?code=abc'
                : null
          }
        } as unknown as Response)
        .mockResolvedValueOnce({
          headers: {
            get: (header: string) =>
              header === 'location'
                ? 'http://localhost:9876/?loginToken=token-from-redirect'
                : null
          },
          text: async () => '<html>no token here</html>'
        } as unknown as Response)

      const result = await tokenService.getLoginToken(
        'https://auth.example.com/authorize',
        'session=abc123',
        'lemonldap=xyz'
      )

      expect(result).toBe('token-from-redirect')
    })

    it('should return null if callback URL origin does not match Matrix server', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        headers: {
          get: (header: string) =>
            header === 'location'
              ? 'https://evil.example.com/_synapse/client/oidc/callback?code=abc'
              : null
        }
      } as unknown as Response)

      const result = await tokenService.getLoginToken(
        'https://auth.example.com/authorize',
        'session=abc123',
        'lemonldap=xyz'
      )

      expect(result).toBeNull()
      // Should NOT have made the second fetch
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should return null if auth provider does not redirect', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        headers: { get: () => null }
      } as unknown as Response)

      const result = await tokenService.getLoginToken(
        'https://auth.example.com/authorize',
        'session=abc123',
        'lemonldap=xyz'
      )

      expect(result).toBeNull()
    })

    it('should return null if something wrong happens', async () => {
      global.fetch = jest.fn(
        async () => await Promise.reject(new Error('API is down'))
      )

      const result = await tokenService.getLoginToken(
        'https://auth.example.com/authorize',
        'session=abc123',
        'lemonldap=xyz'
      )

      expect(result).toBeNull()
    })

    it("should return null if the callback response didn't include a loginToken", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          headers: {
            get: (header: string) =>
              header === 'location'
                ? 'https://example.com/_synapse/client/oidc/callback?code=abc'
                : null
          }
        } as unknown as Response)
        .mockResolvedValueOnce({
          headers: { get: () => null },
          text: async () => '<a href="https://localhost:9876/">continue</a>'
        } as unknown as Response)

      const result = await tokenService.getLoginToken(
        'https://auth.example.com/authorize',
        'session=abc123',
        'lemonldap=xyz'
      )

      expect(result).toBeNull()
    })

    it('should fall through to body when redirect URL has no loginToken', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          headers: {
            get: (header: string) =>
              header === 'location'
                ? 'https://example.com/_synapse/client/oidc/callback?code=abc'
                : null
          }
        } as unknown as Response)
        .mockResolvedValueOnce({
          headers: {
            get: (header: string) =>
              header === 'location'
                ? 'http://localhost:9876/?other=param'
                : null
          },
          text: async () =>
            '<a href="http://localhost:9876/?loginToken=from-body">continue</a>'
        } as unknown as Response)

      const result = await tokenService.getLoginToken(
        'https://auth.example.com/authorize',
        'session=abc123',
        'lemonldap=xyz'
      )

      expect(result).toBe('from-body')
    })

    it('should return null if the Matrix callback request fails', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          headers: {
            get: (header: string) =>
              header === 'location'
                ? 'https://example.com/_synapse/client/oidc/callback?code=abc'
                : null
          }
        } as unknown as Response)
        .mockRejectedValueOnce(new Error('connection refused'))

      const result = await tokenService.getLoginToken(
        'https://auth.example.com/authorize',
        'session=abc123',
        'lemonldap=xyz'
      )

      expect(result).toBeNull()
    })
  })

  describe('the requestAccessToken method', () => {
    it('should request an access_token using the provided loginToken', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            json: async () =>
              await Promise.resolve({ access_token: 'demo_token' })
          } as unknown as Response)
      )

      const result = await tokenService.requestAccessToken('loginToken')

      expect(result).toBe('demo_token')
    })

    it('should call the login API using the correct payload', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            json: async () =>
              await Promise.resolve({ access_token: 'demo_token' })
          } as unknown as Response)
      )

      await tokenService.requestAccessToken('123456')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/_matrix/client/v3/login',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: '123456',
            type: 'm.login.token',
            initial_device_display_name: 'test'
          })
        }
      )
    })

    it('should return null if something wrong happens', async () => {
      global.fetch = jest.fn(
        async () => await Promise.reject(new Error('API is down'))
      )

      const result = await tokenService.requestAccessToken('loginToken')

      expect(result).toBeNull()
    })

    it("should return null if the response didn't include an access_token", async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            json: async () =>
              await Promise.resolve({ something_else: 'demo_token' })
          } as unknown as Response)
      )

      const result = await tokenService.requestAccessToken('loginToken')

      expect(result).toBeNull()
    })

    it('should return null if the response had an error', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            json: async () => await Promise.resolve({ error: 'something' })
          } as unknown as Response)
      )

      const result = await tokenService.requestAccessToken('loginToken')

      expect(result).toBeNull()
    })
  })

  describe('the getAuthCookie method', () => {
    it('should return a cleaned cookie from the auth provider response', async () => {
      global.fetch = jest
        .fn()
        // First call: _getAuthProviderLoginToken
        .mockResolvedValueOnce({
          json: async () => ({ token: 'csrf_token_123' })
        } as unknown as Response)
        // Second call: POST credentials
        .mockResolvedValueOnce({
          headers: {
            getSetCookie: () => [
              'lemonldap=session_id_abc; domain=.example.com; path=/; HttpOnly=1; SameSite=Lax'
            ]
          }
        } as unknown as Response)

      const result = await tokenService.getAuthCookie(
        'admin@example.com',
        'password'
      )

      expect(result).toBe('lemonldap=session_id_abc')
    })

    it('should return null if the auth provider does not return a token', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        json: async () => ({})
      } as unknown as Response)

      const result = await tokenService.getAuthCookie(
        'admin@example.com',
        'password'
      )

      expect(result).toBeNull()
    })

    it('should return null if the auth provider does not set cookies', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ token: 'csrf_token_123' })
        } as unknown as Response)
        .mockResolvedValueOnce({
          headers: { getSetCookie: () => [] }
        } as unknown as Response)

      const result = await tokenService.getAuthCookie(
        'admin@example.com',
        'password'
      )

      expect(result).toBeNull()
    })

    it('should POST credentials with the CSRF token from the auth provider', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ token: 'csrf_token_123' })
        } as unknown as Response)
        .mockResolvedValueOnce({
          headers: {
            getSetCookie: () => ['lemonldap=abc; path=/']
          }
        } as unknown as Response)

      await tokenService.getAuthCookie('admin@example.com', 'secret')

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://auth.example.com',
        {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new URLSearchParams({
            user: 'admin@example.com',
            password: 'secret',
            token: 'csrf_token_123'
          })
        }
      )
    })
  })

  describe('the getAccessTokenWithCreds method', () => {
    it('should return the access token using auth cookie and SSO flow', async () => {
      jest
        .spyOn(tokenService, 'getAuthCookie')
        .mockResolvedValue('lemonldap=session_abc')
      jest
        .spyOn(tokenService, 'getAccessTokenWithCookie')
        .mockResolvedValue('access_token_xyz')

      const result = await tokenService.getAccessTokenWithCreds('admin', 'pass')

      expect(result).toBe('access_token_xyz')
      expect(tokenService.getAuthCookie).toHaveBeenCalledWith('admin', 'pass')
      expect(tokenService.getAccessTokenWithCookie).toHaveBeenCalledWith(
        'lemonldap=session_abc'
      )
    })

    it('should return null if auth cookie acquisition fails', async () => {
      jest.spyOn(tokenService, 'getAuthCookie').mockResolvedValue(null)

      const result = await tokenService.getAccessTokenWithCreds('admin', 'pass')

      expect(result).toBeNull()
    })

    it('should return null if SSO token exchange fails', async () => {
      jest
        .spyOn(tokenService, 'getAuthCookie')
        .mockResolvedValue('lemonldap=session_abc')
      jest
        .spyOn(tokenService, 'getAccessTokenWithCookie')
        .mockResolvedValue(null)

      const result = await tokenService.getAccessTokenWithCreds('admin', 'pass')

      expect(result).toBeNull()
    })
  })

  describe('the getAccessTokenWithCookie method', () => {
    it('should return the access_token using SSO', async () => {
      jest
        .spyOn(tokenService, 'getOidcProvider')
        .mockResolvedValue('test-oidc-provider')
      jest.spyOn(tokenService, 'getOidcRedirectLocation').mockResolvedValue({
        location: 'https://auth.example.com/login',
        cookies: 'cookie1=value1; cookie2=value2'
      })
      jest.spyOn(tokenService, 'getLoginToken').mockResolvedValue('123456')
      jest
        .spyOn(tokenService, 'requestAccessToken')
        .mockResolvedValue('demo_token')

      const result = await tokenService.getAccessTokenWithCookie('loginToken')

      expect(result).toBe('demo_token')
    })

    it('should return null if something wrong happens while fetching the OIDC provider', async () => {
      jest.spyOn(tokenService, 'getOidcProvider').mockResolvedValue(null)

      const result = await tokenService.getAccessTokenWithCookie('loginToken')

      expect(result).toBeNull()
    })

    it("should return null if it couldn't follow the OIDC redirection", async () => {
      jest
        .spyOn(tokenService, 'getOidcProvider')
        .mockResolvedValue('test-oidc-provider')
      jest
        .spyOn(tokenService, 'getOidcRedirectLocation')
        .mockResolvedValue(null)

      const result = await tokenService.getAccessTokenWithCookie('loginToken')

      expect(result).toBeNull()
    })

    it("should return null if it couldn't fetch the loginToken", async () => {
      jest
        .spyOn(tokenService, 'getOidcProvider')
        .mockResolvedValue('test-oidc-provider')
      jest.spyOn(tokenService, 'getOidcRedirectLocation').mockResolvedValue({
        location: 'https://auth.example.com/login',
        cookies: 'cookie1=value1; cookie2=value2'
      })
      jest.spyOn(tokenService, 'getLoginToken').mockResolvedValue(null)

      const result = await tokenService.getAccessTokenWithCookie('loginToken')

      expect(result).toBeNull()
    })

    it("should return null if it couldn't request an access token", async () => {
      jest
        .spyOn(tokenService, 'getOidcProvider')
        .mockResolvedValue('test-oidc-provider')
      jest.spyOn(tokenService, 'getOidcRedirectLocation').mockResolvedValue({
        location: 'https://auth.example.com/login',
        cookies: 'cookie1=value1; cookie2=value2'
      })
      jest.spyOn(tokenService, 'getLoginToken').mockResolvedValue('123456')
      jest.spyOn(tokenService, 'requestAccessToken').mockResolvedValue(null)

      const result = await tokenService.getAccessTokenWithCookie('loginToken')

      expect(result).toBeNull()
    })
  })
})
