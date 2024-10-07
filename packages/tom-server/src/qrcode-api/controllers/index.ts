import { type TwakeLogger } from '@twake/logger'
import {
  type IQRCodeTokenService,
  type IQRCodeApiController,
  type IQRCodeService
} from '../types'
import { type Response, type NextFunction } from 'express'
import type { Config, AuthRequest } from '../../types'
import { QRCodeService, QRCodeTokenService } from '../services'

class QRCodeApiController implements IQRCodeApiController {
  private readonly qrCodeService: IQRCodeService
  private readonly qrCodeTokenService: IQRCodeTokenService

  constructor(private readonly logger: TwakeLogger, config: Config) {
    this.qrCodeService = new QRCodeService(config, logger)
    this.qrCodeTokenService = new QRCodeTokenService(config, logger)
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

      const accessToken = await this.qrCodeTokenService.getAccessToken(cookies)

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
