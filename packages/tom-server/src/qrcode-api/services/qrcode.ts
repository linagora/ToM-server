import QRCode from 'qrcode'
import type { IQRCodeService } from '../types'
import type { TwakeLogger } from '@twake/logger'
import type { Config } from '../../types'

export class QRCodeService implements IQRCodeService {
  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {}

  /**
   * Generates a QR code as a string in SVG format.
   *
   * @param {string} token - The token to be encoded in the QR code.
   * @returns {Promise<string | null>} - The QR code as an SVG string or null if an error occurs.
   */
  getImage = async (token: string): Promise<string | null> => {
    try {
      const url = this.config.qr_code_url

      if (url === undefined) {
        throw new Error('QR code URL is not defined in the configuration.')
      }

      const text = `${url}?access_token=${token}`

      return await QRCode.toString(text, { type: 'svg' })
    } catch (error) {
      this.logger.error('Failed to generate QRCode', { error })

      return null
    }
  }
}
