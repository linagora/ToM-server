import { randomString } from '@twake/crypto'
import fs from 'fs'
import { type Config } from '../../types'
import {
  errMsg,
  isValidUrl,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler,
  clientSecretRegex,
  validCountryRegex,
  validPhoneNumberRegex
} from '@twake/utils'
import type MatrixClientServer from '../../index'
import SmsSender from '../../utils/smsSender'
import { getSubmitUrl } from '../email/requestToken'
import parsePhoneNumberFromString, { type CountryCode } from 'libphonenumber-js'

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
const maxAttemps = 1000000000

export const formatPhoneNumber = (
  rawNumber: string,
  countryCode: string
): string => {
  const phoneNumber = parsePhoneNumberFromString(
    rawNumber,
    countryCode as CountryCode
  )
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain, @typescript-eslint/strict-boolean-expressions
  if (phoneNumber) {
    // Remove the leading '+' if it exists according to MSISDN convention
    return phoneNumber.number.startsWith('+')
      ? phoneNumber.number.slice(1)
      : phoneNumber.number
  }
  return ''
}

export const preConfigureTemplate = (
  template: string,
  conf: Config,
  transport: SmsSender
): string => {
  const baseUrl =
    /* istanbul ignore next */
    getSubmitUrl(conf)
  return (
    template
      // prepare link
      .replace(/__link__/g, `${baseUrl}?__linkQuery__`)
  )
}

export const smsBody = (
  template: string,
  token: string,
  secret: string,
  sid: string
): string => {
  return (
    template
      // set link parameters
      .replace(
        /__linkQuery__/g,
        new URLSearchParams({
          token,
          client_secret: secret,
          sid
        }).toString()
      )
    // set token
  )
}

export const fillTableAndSend = (
  clientServer: MatrixClientServer,
  dst: string,
  clientSecret: string,
  sendAttempt: number,
  verificationTemplate: string,
  transport: SmsSender,
  res: any,
  sid: string,
  nextLink?: string
): void => {
  clientServer.matrixDb
    .createOneTimeToken(sid, clientServer.conf.mail_link_delay, nextLink)
    .then((token) => {
      void transport.sendSMS({
        to: dst,
        raw: smsBody(verificationTemplate, token, clientSecret, sid)
      })
      clientServer.matrixDb
        .insert('threepid_validation_session', {
          client_secret: clientSecret,
          address: dst,
          medium: 'msisdn',
          session_id: sid,
          last_send_attempt: sendAttempt
        })
        .then(() => {
          send(
            res,
            200,
            { sid, submit_url: getSubmitUrl(clientServer.conf) },
            clientServer.logger
          )
        })
        .catch((err) => {
          // istanbul ignore next
          clientServer.logger.error('Insertion error:', err)
          // istanbul ignore next
          send(res, 500, errMsg('unknown', err), clientServer.logger)
        })
    })
    .catch((err) => {
      /* istanbul ignore next */
      clientServer.logger.error('Token error:', err)
      /* istanbul ignore next */
      send(res, 500, errMsg('unknown', err), clientServer.logger)
    })
}

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
          send(
            res,
            400,
            errMsg('invalidParam', 'Invalid client_secret'),
            clientServer.logger
          )
        } else if (!validCountryRegex.test(country)) {
          send(
            res,
            400,
            errMsg('invalidParam', 'Invalid country'),
            clientServer.logger
          )
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        } else if (nextLink && !isValidUrl(nextLink)) {
          send(
            res,
            400,
            errMsg('invalidParam', 'Invalid next_link'),
            clientServer.logger
          )
        } else if (!validPhoneNumberRegex.test(dst)) {
          send(
            res,
            400,
            errMsg('invalidParam', 'Invalid phone number'),
            clientServer.logger
          )
        } else if (
          typeof sendAttempt !== 'number' ||
          sendAttempt > maxAttemps
        ) {
          send(
            res,
            400,
            errMsg('invalidParam', 'Invalid send attempt'),
            clientServer.logger
          )
        } else {
          clientServer.matrixDb
            .get('user_threepids', ['user_id'], { address: dst })
            .then((rows) => {
              if (rows.length > 0) {
                send(res, 400, errMsg('threepidInUse'), clientServer.logger)
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
                        send(
                          res,
                          200,
                          {
                            sid: rows[0].session_id,
                            submit_url: getSubmitUrl(clientServer.conf)
                          },
                          clientServer.logger
                        )
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
                            fillTableAndSend(
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
                            send(
                              res,
                              500,
                              errMsg('unknown', err),
                              clientServer.logger
                            )
                          })
                      }
                    } else {
                      fillTableAndSend(
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
                    send(res, 500, errMsg('unknown', err), clientServer.logger)
                  })
              }
            })
            .catch((err) => {
              /* istanbul ignore next */
              clientServer.logger.error('Error getting userID :', err)
              /* istanbul ignore next */
              send(res, 500, errMsg('unknown', err), clientServer.logger)
            })
        }
      })
    })
  }
}

export default RequestToken
