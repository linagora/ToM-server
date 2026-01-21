import { type TwakeLogger } from '@twake-chat/logger'
import { type IQRCodeApiController, type IQRCodeService } from '../types.ts'
import { type Response, type NextFunction } from 'express'
import type { Config, AuthRequest, ITokenService } from '../../types.ts'
import QRCodeService from '../services/index.ts'
import TokenService from '../../utils/services/token-service.ts'

class QRCodeApiController implements IQRCodeApiController {
  private readonly qrCodeService: IQRCodeService
  private readonly tokenService: ITokenService

  constructor(
    private readonly logger: TwakeLogger,
    config: Config,
    tokenService?: ITokenService
  ) {
    this.qrCodeService = new QRCodeService(config, logger)
    this.tokenService =
      tokenService ?? new TokenService(config, logger, 'qrcode')
  }

  /**
   * Get the QR code for the connected user.
   *
   * @param {AuthRequest} req - The request object.
   * @param {Response} res - The response object.
   * @param {NextFunction} next - The next function.
   */
  get = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const cookies = req.headers.cookie

      if (cookies === undefined) {
        res.status(400).json({ error: 'Cookies are missing' })
        return
      }

      const accessToken = await this.tokenService.getAccessTokenWithCookie(
        cookies
      )

      if (accessToken === null) {
        res.status(400).json({ error: 'Invalid access token' })
        return
      }

      const qrcode = await this.qrCodeService.getImage(accessToken)

      res.setHeader('Content-Type', 'image/svg+xml')
      res.send(qrcode)
    } catch (error) {
      this.logger.error('Failed to generate QR Code', { error })
      next(error)
    }
  }
}

export default QRCodeApiController
