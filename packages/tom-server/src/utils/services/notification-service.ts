import type { TwakeLogger } from '@twake-chat/logger'
import type {
  Config,
  IEmailService,
  INotificationService,
  ISMSService
} from '../../types'
import EmailService from './email-service'
import SmsService from './sms-service'
import type { SendMailOptions } from 'nodemailer'

export default class NotificationService implements INotificationService {
  private emailService: IEmailService
  private smsService: ISMSService
  readonly emailFrom: string

  /**
   * Constructs a new instance of the NotificationService.
   *
   * @param {Config} config - The configuration object.
   * @param {TwakeLogger} logger - The logger instance.
   */
  constructor(config: Config, private readonly logger: TwakeLogger) {
    this.emailService = new EmailService(config)
    this.smsService = new SmsService(config, logger)
    this.emailFrom = this.emailService.from
    this.logger.info('[NotificationService] initialized.')
  }

  /**
   * Sends an SMS to the specified recipient.
   *
   * @param {string} to - The recipient's phone number.
   * @param {string} text - The message to be sent.
   * @returns {Promise<void>}
   */
  public sendSMS = async (to: string, text: string): Promise<void> => {
    try {
      await this.smsService.send(to, text)
    } catch (error) {
      console.error('Failed to send SMS', { error })

      this.logger.error('Failed to send SMS', error)

      throw error
    }
  }

  /**
   * Sends an email to the specified recipient.
   *
   * @param {SendMailOptions} options - The email options.
   * @returns {Promise<void>} - A promise that resolves when the email is sent.
   */
  public sendEmail = async (options: SendMailOptions): Promise<void> => {
    try {
      await this.emailService.send(options)
    } catch (error) {
      console.error('Failed to send email', { error })

      this.logger.error('Failed to send email', error)

      throw error
    }
  }
}
