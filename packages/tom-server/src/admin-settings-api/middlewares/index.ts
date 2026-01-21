import type { IAdminSettingsMiddleware } from '../types.ts'
import type { Request, Response, NextFunction } from 'express'
import type { Config } from '../../types.ts'
// TODO: investigate unused
// import type { TwakeLogger } from '@twake-chat/logger'

export default class AdminSettingsMiddleware
  implements IAdminSettingsMiddleware
{
  constructor(
    private readonly config: Config,
    // TODO: investigate unused
    // private readonly logger: TwakeLogger
  ) {}

  /**
   * Checks the access token for the admin settings
   *
   * @param {Request} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next function
   */
  checkAdminSettingsToken = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const token = this.config.admin_access_token
    const authHeader = req.headers.authorization

    if (authHeader == null || !authHeader.startsWith('Bearer ')) {
      res
        .status(401)
        .json({ error: 'Missing or invalid Authorization header' })
      return
    }

    const receivedToken = authHeader.slice(7) // remove "Bearer "
    if (receivedToken !== token) {
      res.status(403).json({ error: 'Forbidden: invalid token' })
      return
    }

    next()
  }
}
