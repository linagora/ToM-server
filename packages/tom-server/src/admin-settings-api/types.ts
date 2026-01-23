import type { ApiRequestHandler } from '../types'

export enum TokenState {
  NotFetched = 'not_fetched',
  Fetching = 'fetching',
  Ready = 'ready',
  Refreshing = 'refreshing'
}

export interface TokenRetryConfig {
  enabled?: boolean
  initialDelayMs?: number
  maxDelayMs?: number
  maxRetries?: number // 0 = infinite
  backoffMultiplier?: number
}

export const DEFAULT_TOKEN_RETRY_CONFIG: Required<TokenRetryConfig> = {
  enabled: true,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  maxRetries: 0, // 0 = infinite for startup
  backoffMultiplier: 2
}

export const REQUEST_TOKEN_RETRY_CONFIG: Required<TokenRetryConfig> = {
  enabled: true,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  maxRetries: 3, // Bounded for request context
  backoffMultiplier: 2
}
export interface IAdminTokenManager {
  getToken(): Promise<string>
  getState(): TokenState
  invalidateToken(): void
  startTokenAcquisition(): Promise<void>
  stopTokenAcquisition(): void
}
export interface IAdminSettingsService {
  updateUserInformation: (
    userId: string,
    payload: UserInformationPayload
  ) => Promise<void>
  getTokenManager(): IAdminTokenManager
  cleanup(): void
}

export interface IAdminSettingsController {
  handle: ApiRequestHandler
}

export interface IAdminSettingsMiddleware {
  checkAdminSettingsToken: ApiRequestHandler
}

export interface UserInformationPayload {
  displayName?: string
  avatarUrl?: string
}

export interface UploadUserAvatarResponse {
  content_uri?: string
}
