import type { ApiRequestHandler } from '../types'

export interface IAdminSettingsService {
  updateDisplayName: (userId: string, newDisplayName: string) => Promise<void>
}

export interface IAdminSettingsController {
  handle: ApiRequestHandler
}

export interface IAdminSettingsMiddleware {
  checkAdminSettingsToken: ApiRequestHandler
}