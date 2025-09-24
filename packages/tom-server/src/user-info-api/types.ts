import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../types'

export interface IUserInfoController {
  get: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
}

export interface IUserInfoService {
  get: (id: string) => Promise<UserInformation | null>
}

export interface UserInformation {
  uid: string
  givenName: string
  sn: string
  mails?: string[]
  phones?: string[]
}

export interface SettingsPayload {
  language?: string
  timezone?: string
  avatar?: string
  last_name?: string
  first_name?: string
  email?: string
  phone?: string
  matrix_id?: string
  display_name?: string
}

export interface UserSettings {
  matrix_id: string
  settings: SettingsPayload
  version: number
}
