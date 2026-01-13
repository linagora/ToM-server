import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { Config } from '../../types.ts'
import { type TwakeLogger } from '@twake-chat/logger'

/**
 * a Middleware to check if LDAP userdb is enabled.
 *
 * @param {Config} conf the server configuration
 * @returns {RequestHandler} an express middleware function.
 */
export default (conf: Config, logger: TwakeLogger): RequestHandler => {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (conf.userdb_engine !== 'ldap') {
      logger.error('Only LDAP userdb is supported')
      res.status(500).send('Not supported')
      return
    }

    next()
  }
}
