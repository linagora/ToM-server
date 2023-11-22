import { randomString } from '@twake/crypto'
import fs from 'fs'
import { type tokenContent } from '../../account/register'
import type MatrixIdentityServer from '../../index'
import { type Config } from '../../types'
import {
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '../../utils'
import { errMsg } from '../../utils/errors'
import Mailer from '../../utils/mailer'

interface RequestTokenArgs {
  client_secret: string
  email: string
  next_link?: string
  send_attempt: number
}

const schema = {
  client_secret: true,
  email: true,
  next_link: false,
  send_attempt: true
}

const clientSecretRe = /^[0-9a-zA-Z.=_-]{6,255}$/

const validEmailRe = /^\w+([+.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,6})+$/

const preConfigureTemplate = (
  template: string,
  conf: Config,
  transport: Mailer
): string => {
  const mb = randomString(32)
  const baseUrl =
    /* istanbul ignore next */
    (conf.base_url != null && conf.base_url.length > 0
      ? conf.base_url.replace(/\/+$/, '')
      : `https://${conf.server_name}`) +
    '/_matrix/identity/v2/validate/email/submitToken'
  return (
    template
      // initialize "From"
      .replace(/__from__/g, transport.from)
      // fix multipart stuff
      .replace(/__multipart_boundary__/g, mb)
      // prepare link
      .replace(/__link__/g, `${baseUrl}?__linkQuery__`)
  )
}

const mailBody = (
  template: string,
  dst: string,
  token: string,
  secret: string,
  sid: string
): string => {
  return (
    template
      // set "To"
      .replace(/__to__/g, dst)
      // set date
      .replace(/__date__/g, new Date().toUTCString())
      // initialize message id
      .replace(/__messageid__/g, randomString(32))
      // set link parameters
      .replace(
        /__linkQuery__/g,
        new URLSearchParams({
          token,
          client_secret: secret,
          sid
        }).toString()
      )
  )
}

const RequestToken = (idServer: MatrixIdentityServer): expressAppHandler => {
  const transport = new Mailer(idServer.conf)
  const verificationTemplate = preConfigureTemplate(
    fs
      .readFileSync(`${idServer.conf.template_dir}/mailVerification.tpl`)
      .toString(),
    idServer.conf,
    transport
  )
  return (req, res) => {
    idServer.authenticate(req, res, (idToken: tokenContent) => {
      jsonContent(req, res, idServer.logger, (obj) => {
        validateParameters(res, schema, obj, idServer.logger, (obj) => {
          const dst = (obj as RequestTokenArgs).email
          if (!clientSecretRe.test((obj as RequestTokenArgs).client_secret)) {
            send(res, 400, errMsg('invalidParam', 'invalid client_secret'))
          } else {
            if (!validEmailRe.test(dst)) {
              send(res, 400, errMsg('invalidEmail'))
            } else {
              // IDENTITY SERVICE API V1.6 - 11.2
              // send_attempt: The server will only send an email if the
              // send_attempt is a number greater than the most recent one
              // which it has seen, scoped to that email + client_secret pair.
              // This is to avoid repeatedly sending the same email in the
              // case of request retries between the POSTing user and the
              // identity server. The client should increment this value if they desire a new email (e.g. a reminder) to be sent. If they do not, the server should respond with success but not resend the email.

              // TODO: check for send_attempt

              // TODO generate sid and token and store them
              const sid = randomString(64)
              idServer.db
                .createOneTimeToken(
                  {
                    sid,
                    email: dst,
                    client_secret: (obj as RequestTokenArgs).client_secret
                  },
                  idServer.conf.mail_link_delay
                )
                .then((token) => {
                  void transport.sendMail({
                    to: (obj as RequestTokenArgs).email,
                    raw: mailBody(
                      verificationTemplate,
                      dst,
                      token,
                      (obj as RequestTokenArgs).client_secret,
                      sid
                    )
                  })
                  // TODO: send mail
                  send(res, 200, { sid })
                })
                .catch((err) => {
                  /* istanbul ignore next */
                  idServer.logger.error('Token error', err)
                  /* istanbul ignore next */
                  send(res, 400, errMsg('unknown', err))
                })
            }
          }
        })
      })
    })
  }
}

export default RequestToken
