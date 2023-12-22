import { type TwakeLogger } from '@twake/logger'
import { type tokenContent } from '@twake/matrix-identity-server'
import type { NextFunction, RequestHandler, Response } from 'express'
import Authenticate from '../../identity-server/utils/authenticate'
import type { AuthRequest, Config, IdentityServerDb } from '../../types'

export default (
  db: IdentityServerDb,
  conf: Config,
  logger: TwakeLogger
): RequestHandler => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authenticator = Authenticate(db, conf, logger)

    authenticator(req, res, (data: tokenContent, token: string | null) => {
      try {
        if (token === undefined) {
          throw new Error('Missing token')
        }

        /* istanbul ignore if */
        if (data.sub === undefined) {
          throw new Error('Invalid data')
        }

        req.userId = data.sub
        if (token != null) {
          req.accessToken = token
        }
        next()

        return
      } catch (error) {
        logger.error('Auth error', error)
        return res.status(401).json({ error: 'Unauthorized' })
      }
    })
  }
}
