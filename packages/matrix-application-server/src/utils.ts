import { type NextFunction, type Request, type Response } from 'express'
import { type AppServerAPIError } from './errors'

export type expressAppHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void

export type expressAppHandlerError = (
  error: AppServerAPIError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void

