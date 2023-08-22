import { type NextFunction, type Request, type Response } from 'express'
import { VaultAPIError, type expressAppHandler } from '../utils'
import { type Config } from '../../types'
import { type tokenContent } from '@twake/matrix-identity-server'
import { type TwakeDB } from '../../db'
import Authenticate from '../../identity-server/utils/authenticate'

export interface tokenDetail {
  value: string
  content: tokenContent
}

const unauthorizedError = new VaultAPIError('Not Authorized', 401)

export default (db: TwakeDB, conf: Config): expressAppHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authenticator = Authenticate(db, conf)

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
