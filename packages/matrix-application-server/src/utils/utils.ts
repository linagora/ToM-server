import { type NextFunction, type Request, type Response } from 'express'
import { AppServerAPIError, errCodes } from './errors'

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

export enum Endpoints {
  TRANSACTIONS = 'transactions',
  USERS = 'users',
  ROOMS = 'rooms'
}

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

export const legacyEndpointHandler: expressAppHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res
    .status(308)
    .location('/_matrix/app/v1' + req.originalUrl)
    .json({
      errcode: errCodes.unknown,
      error: 'This non-standard endpoint has been removed'
    })
}

export const methodNotAllowed: expressAppHandler = (req, res, next) => {
  throw new AppServerAPIError({ status: 405, code: errCodes.unrecognized })
}
