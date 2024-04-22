import {
  type Config as MConfig,
  type IdentityServerDb as MIdentityServerDb,
  type MatrixErrors
} from '@twake/matrix-identity-server'
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

export type federationServerErrorCode =
  (typeof MatrixErrors.errCodes)[keyof typeof MatrixErrors.errCodes]

export interface ErrorResponseBody {
  error: string
  errcode?: federationServerErrorCode
}

export type middlewaresList = Array<expressAppHandler | expressAppHandlerError>

export type Config = MConfig & {
  trusted_servers_addresses: string[]
}

export type IdentityServerDb = MIdentityServerDb.default

export type Collections = MIdentityServerDb.Collections
