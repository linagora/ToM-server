import { type TwakeLogger } from '@twake/logger'
import { type IQRCodeApiController, type IQRCodeService } from '../types'
import QRCodeService from '../services'
import { type Response, type NextFunction } from 'express'
import { type AuthRequest } from '../../types'

class QRCodeApiController implements IQRCodeApiController {
  private readonly qrCodeService: IQRCodeService

  constructor(private readonly logger: TwakeLogger) {
    this.qrCodeService = new QRCodeService(logger)
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

      const qrcode = await this.qrCodeService.get(accessToken)

      res.setHeader('Content-Type', 'image/svg+xml')
      res.send(qrcode)
    } catch (error) {
      next(error)
    }
  }
}

export default QRCodeApiController
