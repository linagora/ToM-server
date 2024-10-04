import { type TwakeLogger } from '@twake/logger'
import { type Config } from '../../types'
import { QRCodeTokenService } from '../services'

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
    matrix_server: 'http://example.com'
  } as unknown as Config

  const tokenService = new QRCodeTokenService(
    configMock,
    loggerMock as unknown as TwakeLogger
  )

  it('should attempt to fetch an access_token using provided loginToken', async () => {
    global.fetch = jest.fn(
      async () =>
        await Promise.resolve({
          json: async () =>
            await Promise.resolve({ access_token: 'demo_token' })
        } as unknown as Response)
    )

    const result = await tokenService.getAccessToken('loginToken')

    expect(result).toBe('demo_token')
  })

  it('should return null if something wrong happens', async () => {
    global.fetch = jest.fn(
      async () => await Promise.reject(new Error('API is down'))
    )

    const result = await tokenService.getAccessToken('loginToken')

    expect(result).toBeNull()
  })

  it("should return if matrix response doesn't contain an access_token", async () => {
    global.fetch = jest.fn(
      async () =>
        await Promise.resolve({
          json: async () =>
            await Promise.resolve({ not_access_token: 'demo_token' })
        } as unknown as Response)
    )

    const result = await tokenService.getAccessToken('loginToken')

    expect(result).toBeNull()
  })

  it('should return if matrix response contains an error', async () => {
    global.fetch = jest.fn(
      async () =>
        await Promise.resolve({
          json: async () => await Promise.resolve({ error: 'something' })
        } as unknown as Response)
    )
    const result = await tokenService.getAccessToken('loginToken')

    expect(result).toBeNull()
  })
})
