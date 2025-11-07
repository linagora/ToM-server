import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../types'

export interface IUserInfoController {
  get: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
}

export interface IUserInfoService {
  get: (id: string, viewer?: string) => Promise<UserInformation | null>
  getVisibility: (id: string) => Promise<UserProfileSettingsT | undefined>
  updateVisibility: (
    id: string,
    visibilitySettings: UserProfileSettingsT
  ) => Promise<UserProfileSettingsT | undefined>
}

export interface UserInformation {
  uid: string
  display_name?: string
  avatar?: string
  sn?: string
  last_name?: string
  givenName?: string
  first_name?: string
  mails?: string[]
  phones?: string[]
  language?: string
  timezone?: string
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

export enum ProfileField {
  Phone = 'phone',
  Email = 'email'
}

export enum ProfileVisibility {
  Public = 'public',
  Contacts = 'contacts',
  Private = 'private'
}

export interface UserProfileSettingsPayloadT {
  visibility: ProfileVisibility
  visible_fields: ProfileField[]
}

export type UserProfileSettingsT = {
  matrix_id: string
} & UserProfileSettingsPayloadT

export class ForbiddenError extends Error {
  status = 403
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}
