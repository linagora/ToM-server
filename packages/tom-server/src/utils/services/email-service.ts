import {
  type SentMessageInfo,
  type Transporter,
  type SendMailOptions,
  createTransport
} from 'nodemailer'
import { Config, IEmailService, MailerConfig } from '../../types.ts'

export default class EmailService implements IEmailService {
  private transport: Transporter<SentMessageInfo>
  readonly from: string

  /**
   * Creates a new instance of the EmailService class.
   *
   * @param {Config} config - The configuration object containing SMTP settings.
   */
  constructor(config: Config) {
    const opt: MailerConfig = {
      host: config.smtp_server,
      port:
        config.smtp_port && Number(config.smtp_port) ? +config.smtp_port : 25,
      tls: {
        rejectUnauthorized:
          typeof config.smtp_verify_certificate === 'string'
            ? config.smtp_verify_certificate === 'true'
            : config.smtp_verify_certificate ?? false
      }
    }

    opt.secure =
      typeof config.smtp_tls === 'string'
        ? config.smtp_tls === 'true'
        : config.smtp_tls ?? false

    if (config.smtp_user && config.smtp_user !== null) {
      opt.auth = {
        type: 'LOGIN',
        user: config.smtp_user,
        pass: config.smtp_password as string
      }
    }

    this.transport = createTransport(opt)

    this.from =
      config.smtp_sender && config.smtp_sender.length
        ? config.smtp_sender
        : `noreply@${config.server_name}`
  }

  /**
   * sends an email using the configured transporter
   *
   * @param {SendMailOptions} options - MailOptions object containing the email details
   * @returns {Promise<void>} - A Promise that resolves when the email is sent successfully
   */
  public send = async (options: SendMailOptions): Promise<void> => {
    try {
      if (!options.from) {
        options.from = this.from
      }

      await this.transport.sendMail(options)
    } catch (error) {
      console.error('Error sending email:', error)

      throw error
    }
  }
}
