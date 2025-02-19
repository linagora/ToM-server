import type { TwakeLogger } from '@twake/logger'
import { Config, ISMSService, SendSmsPayload } from '../types'
import { buildUrl } from '../utils'

export class SmsService implements ISMSService {
  private API_ENDPOINT: string
  private HEADERS: Record<string, string>
  private readonly sender: string = 'Twake Chat'
  private readonly SEND_ENDPOINT = '/sms-campaign/send'

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {
    const { sms_api_key, sms_api_login, sms_api_url } = this.config

    if (!sms_api_key || !sms_api_login || !sms_api_url) {
      this.logger.error('SMS API configuration is missing')
    }

    this.API_ENDPOINT = buildUrl(sms_api_url as string, this.SEND_ENDPOINT)
    this.HEADERS = {
      'Content-Type': 'application/json',
      'api-login': sms_api_login as string,
      'api-key': sms_api_key as string
    }
  }

  /**
   * sends an sms to the given number
   *
   * @param {string} to - the number to send the sms to
   * @param {string} text - the body of the sms to send
   */
  async send(to: string, text: string): Promise<void> {
    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: this.HEADERS,
        body: JSON.stringify({
          sender: 'Twake',
          recipients: [{ phone_number: to }],
          text,
          type: 'sms_low_cost'
        } satisfies SendSmsPayload)
      })

      const responseBody = await response.json()

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(
          `Failed to send SMS: ${response.status} ${
            (responseBody as any).message
          }`
        )
      }
    } catch (error) {
      console.error('Failed to send SMS', { error })

      this.logger.error('Failed to send SMS', { error })
    }
  }
}
