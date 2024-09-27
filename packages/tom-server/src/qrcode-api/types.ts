import { type Response, type NextFunction } from 'express'
import type { AuthRequest } from '../types'

export interface IQRCodeApiController {
  get: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
}

export interface IQRCodeService {
  get: (id: string) => Promise<string | null>
}
