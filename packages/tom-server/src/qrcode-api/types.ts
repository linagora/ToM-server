import { type Response, type NextFunction } from 'express'
import type { AuthRequest } from '../types'

export interface IQRCodeApiController {
  get: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
}

export interface IQRCodeService {
  getImage: (token: string) => Promise<string | null>
}

export interface IQRCodeTokenService {
  getAccessToken: (cookies: string) => Promise<string | null>
  requestAccessToken: (loginToken: string) => Promise<string | null>
  getOidcProvider: () => Promise<string | null>
  getOidcRedirectLocation: (
    oidcProvider: string
  ) => Promise<OIDCRedirectResponse | null>
  getLoginToken: (
    location: string,
    sessionCookies: string,
    authCookie: string
  ) => Promise<string | null>
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

export interface loginFlowsResponse extends GenericResponse {
  flows: LoginFlow[]
}

export interface LoginFlow {
  type: string
  identity_providers: IdentityProvider[]
}

export interface IdentityProvider {
  name: string
  id: string
}

export interface OIDCRedirectResponse {
  location: string
  cookies: string
}
