import { type tokenContent } from '../../../matrix-identity-server/index'
import { type NextFunction, type Request, type Response } from 'express'
import { type AuthenticationFunction } from '../../types'
import { VaultAPIError, type expressAppHandler } from '../utils'

export interface tokenDetail {
  value: string
  content: tokenContent
}

const unauthorizedError = new VaultAPIError('Not Authorized', 401)

export default (authenticator: AuthenticationFunction): expressAppHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    authenticator(req, res, (data: tokenContent, token: string | null) => {
      /* istanbul ignore if */
      if (token == null) {
        throw unauthorizedError
      }
      req.token = {
        content: data,
        value: token
      }
      next()
    })
  }
}
