import type { TwakeLogger } from '@twake/logger'
import type { Request, Response, NextFunction } from 'express'
import TokenService from '../services/token-service'
import { Config, ITokenService } from '../../types'

export default class CookieAuthenticator {
  private readonly AUTH_COOKIE_NAME = 'lemonldap'
  private tokenService: ITokenService

  /**
   * Constructor
   *
   * @param {Config} config - the configuration object.
   * @param {TwakeLogger} logger - the logger object.
   */
  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {
    this.tokenService = new TokenService(this.config, this.logger, 'middleware')
  }

  /**
   * Authenticate user with cookie
   *
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  public authenticateWithCookie = (
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

      const cookie = req.cookies[this.AUTH_COOKIE_NAME]

      if (!cookie) {
        this.logger.error(`${this.AUTH_COOKIE_NAME} cookie is not found`)
      }

      const token = this.tokenService.getAccessTokenWithCookie(
        `${this.AUTH_COOKIE_NAME}=${cookie}`
      )

      if (!token) {
        this.logger.error(`Failed to authenticate with cookie`)
      }

      req.headers.authorization = `Bearer ${token}`
    } catch (error) {
      this.logger.error(`Failed to authenticate with cookie`, { error })
    } finally {
      next()
    }
  }
}
