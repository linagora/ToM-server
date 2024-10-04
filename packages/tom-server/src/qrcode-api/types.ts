import { type Response, type NextFunction } from 'express'
import type { AuthRequest } from '../types'

export interface IQRCodeApiController {
  get: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
}

export interface IQRCodeService {
  getImage: (token: string) => Promise<string | null>
}

export interface IQRCodeTokenService {
  getAccessToken: (loginToken: string) => Promise<string | null>
}

export interface TokenLoginPayload {
  initial_device_display_name: string
  token: string
  type: string
}

export interface GenericResponse {
  errcode?: string
  error?: string
}

export interface TokenLoginResponse extends GenericResponse {
  access_token: string
  device_id: string
  expires_in_ms: number
  home_server: string
  refresh_token: string
  user_id: string
  well_known?: object
}
