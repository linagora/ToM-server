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
    matrix_server: 'example.com'
  } as unknown as Config

  const tokenService = new TokenService(
    configMock,
    loggerMock as unknown as TwakeLogger,
    'test'
  )

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
    it('should return the location and cookies headers from the redirection response', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            headers: {
              get: (header: string) => {
                if (header === 'location') {
                  return 'https://auth.example.com/login'
                } else if (header === 'set-cookie') {
                  return 'cookie1=value1; cookie2=value2'
                }
              }
            }
          } as unknown as Response)
      )

      const result = await tokenService.getOidcRedirectLocation('oidc_provider')

      expect(result).toEqual({
        location: 'https://auth.example.com/login',
        cookies: 'cookie1=value1; cookie2=value2'
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
              get: (headers: string) => {
                if (headers === 'location') {
                  return 'https://auth.example.com/login'
                }

                return null
              }
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
              get: (headers: string) => {
                if (headers === 'set-cookie') {
                  return 'cookie1=value1; cookie2=value2'
                }

                return null
              }
            }
          } as unknown as Response)
      )

      const result = await tokenService.getOidcRedirectLocation('oidc_provider')

      expect(result).toBeNull()
    })
  })

  describe('the getLoginToken method', () => {
    it('should extract the login token from the response body', async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            text: async () =>
              await Promise.resolve(
                `
                <div id="something">
                  <some-random-html>
                    <a href="https://localhost:9876/?loginToken=123456">continue</a>
                  </some-random-html>
                </div>
                `
              )
          } as unknown as Response)
      )

      const result = await tokenService.getLoginToken(
        'oidc_provider',
        'session-cookie',
        'auth-cookie'
      )

      expect(result).toBe('123456')
    })

    it('should return null if something wrong happens', async () => {
      global.fetch = jest.fn(
        async () => await Promise.reject(new Error('API is down'))
      )

      const result = await tokenService.getLoginToken(
        'oidc_provider',
        'session-cookie',
        'auth-cookie'
      )

      expect(result).toBeNull()
    })

    it("should return null if the response body didn't include a loginToken", async () => {
      global.fetch = jest.fn(
        async () =>
          await Promise.resolve({
            text: async () =>
              await Promise.resolve(
                '<a href="https://localhost:9876/">continue</a>'
              )
          } as unknown as Response)
      )

      const result = await tokenService.getLoginToken(
        'oidc_provider',
        'session-cookie',
        'auth-cookie'
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
