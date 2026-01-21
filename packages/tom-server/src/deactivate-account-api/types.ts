import type { ApiRequestHandler } from '../types.ts'

export interface IAdminService {
  removeAccount: (userId: string) => Promise<void>
  deleteUserMedia: (userId: string, token: string) => Promise<void>
  disableUserAccount: (userId: string, token: string) => Promise<void>
}

export interface IDeactivateUserController {
  handle: ApiRequestHandler
}

export interface IdeactivateUserMiddleware {
  checkUserExists: ApiRequestHandler
  checkAccessToken: ApiRequestHandler
}

export interface DeactivateUserPayload {
  erase: boolean
}

export interface DeleteUserMediaResponse {
  deleted_media: string[]
  total: number
}
