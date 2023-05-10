import { type NextFunction, type Request, type Response } from 'express'
import { AppServerAPIError, ErrCodes, type expressAppHandler } from '../utils'

export default (expectedHomeserverToken: string): expressAppHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const tokenRe = /^Bearer ([a-zA-Z0-9]{64})$/
    let token = ''
    if (req.headers?.authorization != null) {
      const re = req.headers.authorization.match(tokenRe)
      if (re != null) {
        token = re[1]
      }
    } else {
      throw new AppServerAPIError({
        status: 401,
        code: ErrCodes.M_UNAUTHORIZED
      })
    }
    if (expectedHomeserverToken === token) {
      next()
    } else {
      throw new AppServerAPIError({
        status: 403,
        code: ErrCodes.M_FORBIDDEN
      })
    }
  }
}
