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
const validEmailRe = /^\w[+.-\w]*\w@\w[.-\w]*\w\.\w{2,6}$/

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

const fillTable = (
  idServer: MatrixIdentityServer,
  dst: string,
  clientSecret: string,
  sendAttempt: number,
  verificationTemplate: string,
  transport: Mailer,
  res: any
): void => {
  const sid = randomString(64)
  idServer.db
    .createOneTimeToken(
      {
        sid,
        email: dst,
        client_secret: clientSecret
      },
      idServer.conf.mail_link_delay
    )
    .then((token) => {
      void transport.sendMail({
        to: dst,
        raw: mailBody(verificationTemplate, dst, token, clientSecret, sid)
      })
      idServer.db
        .insert('mappings', {
          client_secret: clientSecret,
          address: dst,
          medium: 'email',
          valid: 0,
          submit_time: 0,
          session_id: sid,
          send_attempt: sendAttempt
        })
        .then(() => {
          send(res, 200, { sid })
        })
        .catch((err) => {
          // istanbul ignore next
          idServer.logger.error('Insertion error', err)
          // istanbul ignore next
          send(res, 400, errMsg('unknown', err))
        })
    })
    .catch((err) => {
      /* istanbul ignore next */
      idServer.logger.error('Token error', err)
      /* istanbul ignore next */
      send(res, 400, errMsg('unknown', err))
    })
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
          const clientSecret = (obj as RequestTokenArgs).client_secret
          const sendAttempt = (obj as RequestTokenArgs).send_attempt
          const dst = (obj as RequestTokenArgs).email

          if (!clientSecretRe.test(clientSecret)) {
            send(res, 400, errMsg('invalidParam', 'invalid client_secret'))
          } else if (!validEmailRe.test(dst)) {
            send(res, 400, errMsg('invalidEmail'))
          } else {
            idServer.db
              .get('mappings', ['send_attempt', 'session_id'], {
                client_secret: clientSecret,
                address: dst
              })
              .then((rows) => {
                if (rows.length > 0) {
                  if (sendAttempt === rows[0].send_attempt) {
                    send(res, 200, { sid: rows[0].session_id })
                  } else {
                    idServer.db
                      .deleteEqualAnd(
                        'mappings',
                        { field: 'client_secret', value: clientSecret },
                        { field: 'session_id', value: rows[0].session_id }
                      )
                      .then(() => {
                        fillTable(
                          idServer,
                          dst,
                          clientSecret,
                          sendAttempt,
                          verificationTemplate,
                          transport,
                          res
                        )
                      })
                      .catch((err) => {
                        // istanbul ignore next
                        idServer.logger.error('Deletion error', err)
                        // istanbul ignore next
                        send(res, 400, errMsg('unknown', err))
                      })
                  }
                } else {
                  fillTable(
                    idServer,
                    dst,
                    clientSecret,
                    sendAttempt,
                    verificationTemplate,
                    transport,
                    res
                  )
                }
              })
              .catch((err) => {
                /* istanbul ignore next */
                idServer.logger.error('Send_attempt error', err)
                /* istanbul ignore next */
                send(res, 400, errMsg('unknown', err))
              })
          }
        })
      })
    })
  }
}

export default RequestToken
