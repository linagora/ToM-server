import QRCode from 'qrcode'
import type { IQRCodeService } from '../types'
import type { TwakeLogger } from '@twake/logger'

class QRCodeService implements IQRCodeService {
  constructor(private readonly logger: TwakeLogger) {}
  /**
   * Generates a QR code as a string in SVG format.
   *
   * @param {string} text - The text to be encoded in the QR code.
   * @returns {Promise<string | null>} - The QR code as an SVG string or null if an error occurs.
   */
  get = async (text: string): Promise<string | null> => {
    try {
      return await QRCode.toString(text, { type: 'svg' })
    } catch (error) {
      this.logger.error('Failed to generate QRCode', { error })

      return null
    }
  }
}

export default QRCodeService
