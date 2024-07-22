import { randomString } from '@twake/crypto'
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
import SmsSender from '../../../utils/smsSender'
import { getSubmitUrl } from '../../../register/email/requestToken'
import {
  fillTable,
  formatPhoneNumber,
  preConfigureTemplate
} from '../../../register/msisdn/requestToken'

interface RequestTokenArgs {
  client_secret: string
  country: string
  phone_number: string
  next_link?: string
  send_attempt: number
  id_server?: string
  id_access_token?: string
}

const schema = {
  client_secret: true,
  country: true,
  phone_number: true,
  next_link: false,
  send_attempt: true,
  id_server: false,
  id_access_token: false
}

const clientSecretRegex = /^[0-9a-zA-Z.=_-]{6,255}$/
const validCountryRegex = /^[A-Z]{2}$/ // ISO 3166-1 alpha-2 as per the spec : https://spec.matrix.org/v1.11/client-server-api/#post_matrixclientv3registermsisdnrequesttoken
const validPhoneNumberRegex = /^[1-9]\d{1,14}$/
const maxAttemps = 1000000000

const RequestToken = (clientServer: MatrixClientServer): expressAppHandler => {
  const transport = new SmsSender(clientServer.conf)
  const verificationTemplate = preConfigureTemplate(
    fs
      .readFileSync(`${clientServer.conf.template_dir}/smsVerification.tpl`)
      .toString(),
    clientServer.conf,
    transport
  )
  return (req, res) => {
    jsonContent(req, res, clientServer.logger, (obj) => {
      validateParameters(res, schema, obj, clientServer.logger, (obj) => {
        const clientSecret = (obj as RequestTokenArgs).client_secret
        const sendAttempt = (obj as RequestTokenArgs).send_attempt
        const country = (obj as RequestTokenArgs).country
        const phoneNumber = (obj as RequestTokenArgs).phone_number
        const dst = formatPhoneNumber(phoneNumber, country)
        const nextLink = (obj as RequestTokenArgs).next_link
        if (!clientSecretRegex.test(clientSecret)) {
          send(res, 400, errMsg('invalidParam', 'Invalid client_secret'))
        } else if (!validCountryRegex.test(country)) {
          send(res, 400, errMsg('invalidParam', 'Invalid country'))
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        } else if (nextLink && !isValidUrl(nextLink)) {
          send(res, 400, errMsg('invalidParam', 'Invalid next_link'))
        } else if (!validPhoneNumberRegex.test(dst)) {
          send(res, 400, errMsg('invalidParam', 'Invalid phone number'))
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
                            clientServer.logger.error('Deletion error:', err)
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
                    clientServer.logger.error('Send_attempt error:', err)
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
