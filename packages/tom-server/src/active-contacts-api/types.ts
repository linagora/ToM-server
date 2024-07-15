import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../types'

export interface IActiveContactsApiController {
  get: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
  save: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
  delete: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
}

export interface IActiveContactsApiValidationMiddleware {
  checkCreationRequirements: (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => void
}

export interface IActiveContactsService {
  get: (userId: string) => Promise<string | null>
  save: (userId: string, targetId: string) => Promise<void>
  delete: (userId: string) => Promise<void>
}

export interface ActiveAcountsData {
  contacts: string
}
