import { type SupportedDatabases } from './db/sql/sql'
import { type NextFunction, type Request, type Response } from 'express'

export interface Config {
  database_engine: SupportedDatabases
  database_host: string
  server_name: string
}

export type expressAppHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void

export type expressAppHandlerError = (
  error: VaultAPIError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void

export const allowCors: expressAppHandler = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  )
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  )
  next()
}

export const errorMiddleware: expressAppHandlerError = (
  error,
  req,
  res,
  next
) => {
  const vaultError: VaultAPIError =
    error instanceof VaultAPIError
      ? error
      : new VaultAPIError(error.message, 500)
  res.status(vaultError.statusCode)
  res.json({
    error: vaultError.message
  })
}

export class VaultAPIError extends Error {
  statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}
