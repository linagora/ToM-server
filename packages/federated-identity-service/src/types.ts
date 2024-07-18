import {
  type IdentityServerDb,
  type Config as MConfig
} from '@twake/matrix-identity-server'
import { type errCodes } from '@twake/utils'
import { type NextFunction, type Request, type Response } from 'express'

export type expressAppHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void

export type expressAppHandlerError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void

export interface AuthRequest extends Request {
  userId?: string
  accessToken?: string
}

export type federatedIdentityServiceErrorCode =
  (typeof errCodes)[keyof typeof errCodes]

export interface ErrorResponseBody {
  error: string
  errcode?: federatedIdentityServiceErrorCode
}

export type middlewaresList = Array<expressAppHandler | expressAppHandlerError>

export type Config = MConfig & {
  trusted_servers_addresses: string[]
}

export type fdDbCollections = 'hashByServer'

export type FdServerDb = IdentityServerDb<fdDbCollections>
