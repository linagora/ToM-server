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
}
