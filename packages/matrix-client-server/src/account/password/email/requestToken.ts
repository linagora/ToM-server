import fs from 'fs'
import {
  errMsg,
  isValidUrl,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake/utils'
import type MatrixClientServer from '../../../index'
import Mailer from '../../../utils/mailer'
import {
  fillTable,
  getSubmitUrl,
  preConfigureTemplate
} from '../../../register/email/requestToken'
import { randomString } from '@twake/crypto'

interface RequestTokenArgs {
  client_secret: string
  email: string
  next_link?: string
  send_attempt: number
  id_server?: string
  id_access_token?: string
}

const schema = {
  client_secret: true,
  email: true,
  next_link: false,
  send_attempt: true,
  id_server: false,
  id_access_token: false
}

const clientSecretRe = /^[0-9a-zA-Z.=_-]{6,255}$/
const validEmailRe = /^\w[+.-\w]*\w@\w[.-\w]*\w\.\w{2,6}$/
const maxAttemps = 1000000000

const RequestToken = (clientServer: MatrixClientServer): expressAppHandler => {
  const transport = new Mailer(clientServer.conf)
  const verificationTemplate = preConfigureTemplate(
    fs
      .readFileSync(`${clientServer.conf.template_dir}/mailVerification.tpl`)
      .toString(),
    clientServer.conf,
    transport
  )
  return (req, res) => {
    jsonContent(req, res, clientServer.logger, (obj) => {
      validateParameters(res, schema, obj, clientServer.logger, (obj) => {
        const clientSecret = (obj as RequestTokenArgs).client_secret
        const sendAttempt = (obj as RequestTokenArgs).send_attempt
        const dst = (obj as RequestTokenArgs).email
        const nextLink = (obj as RequestTokenArgs).next_link
        if (!clientSecretRe.test(clientSecret)) {
          send(res, 400, errMsg('invalidParam', 'invalid client_secret'))
        } else if (!validEmailRe.test(dst)) {
          send(res, 400, errMsg('invalidEmail'))
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        } else if (nextLink && !isValidUrl(nextLink)) {
          send(res, 400, errMsg('invalidParam', 'invalid next_link'))
        } else if (
          typeof sendAttempt !== 'number' ||
          sendAttempt > maxAttemps
        ) {
          send(res, 400, errMsg('invalidParam', 'Invalid send attempt'))
        } else {
          clientServer.matrixDb
            .get('user_threepids', ['user_id'], { address: dst })
            .then((rows) => {
              if (rows.length === 0) {
                send(res, 400, errMsg('threepidNotFound'))
              } else {
                clientServer.matrixDb
                  .get(
                    'threepid_validation_session',
                    ['last_send_attempt', 'session_id'],
                    {
                      client_secret: clientSecret,
                      address: dst
                    }
                  )
                  .then((rows) => {
                    if (rows.length > 0) {
                      if (sendAttempt === rows[0].last_send_attempt) {
                        send(res, 200, {
                          sid: rows[0].session_id,
                          submit_url: getSubmitUrl(clientServer.conf)
                        })
                      } else {
                        clientServer.matrixDb
                          .deleteWhere('threepid_validation_session', [
                            {
                              field: 'client_secret',
                              value: clientSecret,
                              operator: '='
                            },
                            {
                              field: 'session_id',
                              value: rows[0].session_id as string,
                              operator: '='
                            }
                          ])
                          .then(() => {
                            fillTable(
                              // The calls to send are made in this function
                              clientServer,
                              dst,
                              clientSecret,
                              sendAttempt,
                              verificationTemplate,
                              transport,
                              res,
                              rows[0].session_id as string,
                              nextLink
                            )
                          })
                          .catch((err) => {
                            // istanbul ignore next
                            clientServer.logger.error('Deletion error', err)
                            // istanbul ignore next
                            send(res, 500, errMsg('unknown', err))
                          })
                      }
                    } else {
                      fillTable(
                        // The calls to send are made in this function
                        clientServer,
                        dst,
                        clientSecret,
                        sendAttempt,
                        verificationTemplate,
                        transport,
                        res,
                        randomString(64),
                        nextLink
                      )
                    }
                  })
                  .catch((err) => {
                    /* istanbul ignore next */
                    clientServer.logger.error('Send_attempt error', err)
                    /* istanbul ignore next */
                    send(res, 500, errMsg('unknown', err))
                  })
              }
            })
            .catch((err) => {
              /* istanbul ignore next */
              clientServer.logger.error('Error getting userID :', err)
              /* istanbul ignore next */
              send(res, 500, errMsg('unknown', err))
            })
        }
      })
    })
  }
}

export default RequestToken
