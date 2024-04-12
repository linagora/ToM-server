import {
  AppServerAPIError,
  type expressAppHandler
} from '@twake/matrix-application-server'
import { type NextFunction, type Request, type Response } from 'express'

export const auth: expressAppHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const tokenRe = /^Bearer (\S+)$/
  let token = null
  if (req.headers?.authorization != null) {
    const re = req.headers.authorization.match(tokenRe)
    if (re != null) {
      token = re[1]
    }
  } else {
    throw new AppServerAPIError({
      status: 401,
      message: 'Not authorized'
    })
  }
  if (token != null) {
    // We should decide how to authenticate an administrator
    next()
  } else {
    throw new AppServerAPIError({
      status: 403,
      message: 'Forbidden'
    })
  }
}
