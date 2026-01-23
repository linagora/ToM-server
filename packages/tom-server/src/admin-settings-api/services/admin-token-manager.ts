import type { TwakeLogger } from '@twake/logger'
import {
  type IAdminTokenManager,
  type TokenRetryConfig,
  TokenState,
  DEFAULT_TOKEN_RETRY_CONFIG
} from '../types'
import type { ITokenService, Config } from '../../types'

export default class AdminTokenManager implements IAdminTokenManager {
  private state: TokenState = TokenState.NotFetched
  private token: string | null = null
  private retryConfig: Required<TokenRetryConfig>
  private retryAttempts: number = 0
  private retryTimeoutId?: ReturnType<typeof setTimeout>
  private isIntentionalStop: boolean = false
  private tokenPromise: Promise<string> | null = null
  private tokenPromiseResolve: ((value: string) => void) | null = null
  private tokenPromiseReject: ((reason: Error) => void) | null = null

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger,
    private readonly tokenService: ITokenService,
    retryConfig?: TokenRetryConfig
  ) {
    this.retryConfig = { ...DEFAULT_TOKEN_RETRY_CONFIG, ...retryConfig }
  }

  public async startTokenAcquisition(): Promise<void> {
    this.logger.info('[AdminTokenManager] Starting token acquisition...')
    this.isIntentionalStop = false
    this.retryAttempts = 0
    this.state = TokenState.Fetching
    this.tokenPromise = new Promise<string>((resolve, reject) => {
      this.tokenPromiseResolve = resolve
      this.tokenPromiseReject = reject
    })
    this.attemptTokenFetch()
    return
  }

  public async getToken(): Promise<string> {
    if (this.state === TokenState.Ready && this.token) {
      return this.token
    }
    if (
      this.state === TokenState.Fetching ||
      this.state === TokenState.Refreshing
    ) {
      return this.tokenPromise!
    }
    this.startTokenAcquisition()
    return this.tokenPromise!
  }

  public invalidateToken(): void {
    this.logger.warn('[AdminTokenManager] Token invalidated')
    this.token = null
    this.state = TokenState.NotFetched
  }

  public stopTokenAcquisition(): void {
    this.logger.info('[AdminTokenManager] Token acquisition stopped')
    this.isIntentionalStop = true
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
    if (this.tokenPromiseReject) {
      this.tokenPromiseReject(new Error('Token acquisition stopped'))
    }
  }

  public getState(): TokenState {
    return this.state
  }
  private async attemptTokenFetch() {
    if (this.isIntentionalStop) {
      return
    }
    try {
      const accessToken = await this.tokenService.getAccessTokenWithCreds(
        this.config.matrix_admin_login,
        this.config.matrix_admin_password
      )
      if (accessToken === null) {
        this.logger.warn(
          '[AdminTokenManager] Token service returned null, will retry'
        )
        this.scheduleRetry()
        return
      }
      this.token = accessToken
      this.state = TokenState.Ready
      this.retryAttempts = 0
      this.logger.info('[AdminTokenManager] Token acquired successfully')
      if (this.tokenPromiseResolve) {
        this.tokenPromiseResolve(this.token)
      }
    } catch (error) {
      this.logger.error('[AdminTokenManager] Token fetch failed', { error })
      this.scheduleRetry()
    }
  }

  private scheduleRetry(): void {
    if (
      this.retryConfig.maxRetries > 0 &&
      this.retryAttempts >= this.retryConfig.maxRetries
    ) {
      this.logger.error(
        `[AdminTokenManager] Max retries (${this.retryConfig.maxRetries}) reached.`
      )
      if (this.tokenPromiseReject) {
        this.tokenPromiseReject(
          new Error('Token acquisition failed after max retries')
        )
      }
      this.state = TokenState.NotFetched
      return
    }
    this.retryAttempts++
    const delay = this.calculateRetryDelay()
    this.state = TokenState.Refreshing
    this.logger.info(
      `[AdminTokenManager] Scheduling retry attempt ${this.retryAttempts} in ${delay}ms`
    )
    this.retryTimeoutId = setTimeout(() => this.attemptTokenFetch(), delay)
  }

  private calculateRetryDelay(): number {
    const delay = Math.min(
      this.retryConfig.initialDelayMs *
        Math.pow(this.retryConfig.backoffMultiplier, this.retryAttempts),
      this.retryConfig.maxDelayMs
    )
    const jitter = delay * 0.1 * Math.random()
    return Math.floor(delay + jitter)
  }
}
