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
      const { accessToken } = req

      if (accessToken === undefined || accessToken.length === 0) {
        res.status(400).json({ error: 'Access token is missing' })
        return
      }

      const token = await this.qrCodeTokenService.getAccessToken(accessToken)

      if (token === null) {
        res.status(400).json({ error: 'Invalid access token' })
        return
      }

      const qrcode = await this.qrCodeService.getImage(token)

      res.setHeader('Content-Type', 'image/svg+xml')
      res.send(qrcode)
    } catch (error) {
      this.logger.error('Failed to generate QR Code', { error })
      next(error)
    }
  }
}

export default QRCodeApiController
