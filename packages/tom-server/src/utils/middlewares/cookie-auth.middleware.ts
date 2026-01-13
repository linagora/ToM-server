import type { TwakeLogger } from '@twake-chat/logger'
import type { Request, Response, NextFunction } from 'express'
import TokenService from '../services/token-service'
import { Config, ITokenService } from '../../types'

export default class CookieAuthenticator {
  private tokenService: ITokenService

  /**
   * Constructor
   *
   * @param {Config} config - the configuration object.
   * @param {TwakeLogger} logger - the logger object.
   * @param {ITokenService} tokenService - optional tokenService singleton.
   */
  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger,
    tokenService?: ITokenService
  ) {
    this.tokenService =
      tokenService ?? new TokenService(this.config, this.logger, 'middleware')
  }

  /**
   * Authenticate user with cookie
   *
   * @param {Request} req - the request object.
   * @param {Response} _res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  public authenticateWithCookie = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    try {
      if (req.headers.authorization) {
        this.logger.error(
          `Authorization header already exists, skipping cookie auth`
        )

        next()
        return
      }

      const cookie = req.headers?.['cookie'] as string

      if (!cookie) {
        this.logger.error('cookie is not found')

        throw new Error('cookie is not found')
      }

      const token = await this.tokenService.getAccessTokenWithCookie(cookie)

      if (!token) {
        this.logger.error('Failed to obtain token with cookie')

        throw new Error('Failed to obtain token with cookie')
      }

      req.headers.authorization = `Bearer ${token}`

      next()
    } catch (error) {
      this.logger.error(`Failed to authenticate with cookie`, { error })

      next()
    }
  }
}
