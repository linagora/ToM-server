import type { ApiRequestHandler } from '../types'

export interface IAdminSettingsService {
  updateUserInformation: (
    userId: string,
    payload: UserInformationPayload
  ) => Promise<void>
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
