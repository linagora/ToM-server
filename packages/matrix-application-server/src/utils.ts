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
