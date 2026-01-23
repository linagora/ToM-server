import AdminTokenManager from '../services/admin-token-manager'
import {
  TokenState,
  REQUEST_TOKEN_RETRY_CONFIG,
  DEFAULT_TOKEN_RETRY_CONFIG
} from '../types'
import { ITokenService } from '../../types'
import { TwakeLogger } from '@twake/logger'
import type { Config } from '../../types'

const mockConfig = {
  matrix_admin_login: 'admin',
  matrix_admin_password: 'password'
}

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}

const mockTokenService = {
  getAccessTokenWithCreds: jest.fn()
}

describe('AdminTokenManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })
  it('should start in NotFetched state', () => {
    const manager = new AdminTokenManager(
      mockConfig as Config,
      mockLogger as unknown as TwakeLogger,
      mockTokenService as unknown as ITokenService
    )
    expect(manager.getState()).toBe(TokenState.NotFetched)
  })

  it('should fetch and cache a token', async () => {
    mockTokenService.getAccessTokenWithCreds.mockResolvedValue('cached-token')
    const manager = new AdminTokenManager(
      mockConfig as Config,
      mockLogger as unknown as TwakeLogger,
      mockTokenService as unknown as ITokenService
    )
    const tokenPromise = manager.getToken()
    expect(manager.getState()).toBe(TokenState.Fetching)
    await jest.runAllTimers()
    const token = await tokenPromise
    expect(token).toBe('cached-token')
    expect(manager.getState()).toBe(TokenState.Ready)
    expect(mockTokenService.getAccessTokenWithCreds).toHaveBeenCalledTimes(1)

    const token2 = await manager.getToken()
    expect(token2).toBe('cached-token')
    expect(mockTokenService.getAccessTokenWithCreds).toHaveBeenCalledTimes(1)
  })
  it('should retry on null token', async () => {
    mockTokenService.getAccessTokenWithCreds
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('new-token')
    const manager = new AdminTokenManager(
      mockConfig as Config,
      mockLogger as unknown as TwakeLogger,
      mockTokenService as unknown as ITokenService
    )
    const tokenPromise = manager.getToken()
    expect(manager.getState()).toBe(TokenState.Fetching)
    await jest.runAllTimers()
    expect(manager.getState()).toBe(TokenState.Refreshing)
    await jest.runAllTimers()
    const token = await tokenPromise
    expect(token).toBe('new-token')
    expect(manager.getState()).toBe(TokenState.Ready)
    expect(mockTokenService.getAccessTokenWithCreds).toHaveBeenCalledTimes(2)
  })
  it('should retry on exception', async () => {
    mockTokenService.getAccessTokenWithCreds
      .mockRejectedValueOnce(new Error('test-error'))
      .mockResolvedValueOnce('new-token')
    const manager = new AdminTokenManager(
      mockConfig as Config,
      mockLogger as unknown as TwakeLogger,
      mockTokenService as unknown as ITokenService
    )
    const tokenPromise = manager.getToken()
    expect(manager.getState()).toBe(TokenState.Fetching)
    await jest.runAllTimers()
    expect(manager.getState()).toBe(TokenState.Refreshing)
    await jest.runAllTimers()
    const token = await tokenPromise
    expect(token).toBe('new-token')
    expect(manager.getState()).toBe(TokenState.Ready)
    expect(mockTokenService.getAccessTokenWithCreds).toHaveBeenCalledTimes(2)
  })

  it('should stop retrying after maxRetries', async () => {
    mockTokenService.getAccessTokenWithCreds.mockResolvedValue(null)
    const manager = new AdminTokenManager(
      mockConfig as Config,
      mockLogger as unknown as TwakeLogger,
      mockTokenService as unknown as ITokenService,
      REQUEST_TOKEN_RETRY_CONFIG
    )
    const tokenPromise = manager.getToken()

    // Run timers and flush promises for each retry
    for (let i = 0; i <= REQUEST_TOKEN_RETRY_CONFIG.maxRetries; i++) {
      await Promise.resolve() // Flush promises
      jest.runAllTimers()
    }
    await Promise.resolve() // Final flush

    await expect(tokenPromise).rejects.toThrow(
      'Token acquisition failed after max retries'
    )
    expect(manager.getState()).toBe(TokenState.NotFetched)
    expect(mockTokenService.getAccessTokenWithCreds).toHaveBeenCalledTimes(
      REQUEST_TOKEN_RETRY_CONFIG.maxRetries + 1
    )
  })
  it('should invalidate token', async () => {
    mockTokenService.getAccessTokenWithCreds.mockResolvedValue('cached-token')
    const manager = new AdminTokenManager(
      mockConfig as Config,
      mockLogger as unknown as TwakeLogger,
      mockTokenService as unknown as ITokenService
    )
    await manager.getToken()
    await jest.runAllTimers()
    expect(manager.getState()).toBe(TokenState.Ready)
    manager.invalidateToken()
    expect(manager.getState()).toBe(TokenState.NotFetched)
    mockTokenService.getAccessTokenWithCreds.mockResolvedValue('new-token')
    const token = await manager.getToken()
    await jest.runAllTimers()
    expect(token).toBe('new-token')
    expect(manager.getState()).toBe(TokenState.Ready)
    expect(mockTokenService.getAccessTokenWithCreds).toHaveBeenCalledTimes(2)
  })

  it('should stop acquisition', async () => {
    mockTokenService.getAccessTokenWithCreds.mockResolvedValue(null)
    const manager = new AdminTokenManager(
      mockConfig as Config,
      mockLogger as unknown as TwakeLogger,
      mockTokenService as unknown as ITokenService,
      DEFAULT_TOKEN_RETRY_CONFIG
    )
    const tokenPromise = manager.getToken()
    await jest.runAllTimers()
    expect(manager.getState()).toBe(TokenState.Refreshing)
    manager.stopTokenAcquisition()
    await expect(tokenPromise).rejects.toThrow('Token acquisition stopped')
  })
})
