// TODO : Add Mailer to @twake/utils after creating a union-type Config = clientServerConfig | identityServerConfig | federatedIdentityServerConfig ... and changing to Config to the right subtype in the relevant files

import nodeMailer, {
  type Transporter,
  type SentMessageInfo,
  type SendMailOptions
} from 'nodemailer'
import { type Config } from '../types'

class Mailer {
  transport: Transporter<SentMessageInfo>
  from: string
  constructor(conf: Config) {
    const opt: {
      host: string
      port: number
      auth?: Record<string, string>
      secure?: boolean
      tls: {
        rejectUnauthorized?: boolean
      }
    } = {
      host: conf.smtp_server,
      /* istanbul ignore next */
      port: conf.smtp_port != null ? conf.smtp_port : 25,
      tls: { rejectUnauthorized: conf.smtp_verify_certificate }
    }
    if (conf.smtp_tls != null) {
      opt.secure = conf.smtp_tls
    }
    if (conf.smtp_user != null) {
      opt.auth = {
        type: 'LOGIN',
        user: conf.smtp_user,
        pass: conf.smtp_password as string
      }
    }
    this.transport = nodeMailer.createTransport(opt)
    /* istanbul ignore next */
    this.from =
      conf.smtp_sender != null && conf.smtp_sender.length > 0
        ? conf.smtp_sender
        : `no-reply@${conf.server_name}`
  }

  async sendMail(opt: SendMailOptions): Promise<void> {
    if (opt.from == null) {
      opt.from = this.from
    }
    await this.transport.sendMail(opt)
  }
}

export default Mailer
