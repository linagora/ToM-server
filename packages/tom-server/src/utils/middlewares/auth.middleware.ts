import type { NextFunction, RequestHandler, Response } from 'express'
import type { Config, IdentityServerDb, AuthRequest } from '../../types'
import Authenticate from '../../identity-server/utils/authenticate'
import { type tokenContent } from '@twake/matrix-identity-server'

export default (db: IdentityServerDb, conf: Config): RequestHandler => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authenticator = Authenticate(db, conf)

    authenticator(req, res, (data: tokenContent, token: string | undefined) => {
      try {
        if (token === undefined) {
          throw new Error('Missing token')
        }

        /* istanbul ignore if */
        if (data.sub === undefined) {
          throw new Error('Invalid data')
        }

        req.userId = data.sub
        req.accessToken = token
        next()

        return
      } catch (error) {
        console.error('Auth error', error)
        return res.status(401).json({ error: 'Unauthorized' })
      }
    })
  }
}
