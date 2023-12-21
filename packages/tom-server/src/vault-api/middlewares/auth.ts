import { type TwakeLogger } from '@twake/logger'
import { type tokenContent } from '@twake/matrix-identity-server'
import { type NextFunction, type Request, type Response } from 'express'
import { type TwakeDB } from '../../db'
import Authenticate from '../../identity-server/utils/authenticate'
import { type Config } from '../../types'
import { VaultAPIError, type expressAppHandler } from '../utils'

export interface tokenDetail {
  value: string
  content: tokenContent
}

const unauthorizedError = new VaultAPIError('Not Authorized', 401)

export default (
  db: TwakeDB,
  conf: Config,
  logger: TwakeLogger
): expressAppHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authenticator = Authenticate(db, conf, logger)

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
