import { randomString } from '@twake/crypto'
import fetch from 'node-fetch'
import fs from 'fs'
import {
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '../utils'
import { errMsg } from '../utils/errors'
import type MatrixIdentityServer from '../index'
import Mailer from '../utils/mailer'
import { type Config } from '../types'

interface storeInvitationArgs {
  address: string
  medium: string
  room_alias?: string
  room_avatar_url?: string
  room_id: string
  room_join_rules?: string
  room_name?: string
  room_type?: string
  sender: string
  sender_avatar_url?: string
  sender_display_name?: string
}

const schema = {
  address: true,
  medium: true,
  room_alias: false,
  room_avatar_url: false,
  room_id: true,
  room_join_rules: false,
  room_name: false,
  room_type: false,
  sender: true,
  sender_avatar_url: false,
  sender_display_name: false
}

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
      : `https://${conf.server_name}`) + '/_matrix/identity/v2/store-invite'
  return (
    template
      // initialize "From"
      .replace(/__from__/g, transport.from)
      // fix multipart stuff
      .replace(/__multipart_boundary__/g, mb) // c'est quoi ca ?
      // prepare link
      .replace(/__link__/g, `${baseUrl}?__linkQuery__`) // TO DO : adapt to new link
  )
}

const mailBody = (
  template: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  inviter_name: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  dst: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  room_name?: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  room_avatar?: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  room_type?: string
): string => {
  // TO DO : complete new template
  return (
    template
      // set "To"
      .replace(/__to__/g, dst)
      // Set __inviter_name__
      .replace(/__inviter_name__/g, inviter_name)
      // set date
      .replace(/__date__/g, new Date().toUTCString())
      // initialize message id
      .replace(/__messageid__/g, randomString(32))
      // set link parameters
      .replace(
        /__linkQuery__/g,
        new URLSearchParams({
          /* TO DO */
        }).toString()
      )
      .replace(/__room_name__/g, room_name ?? '')
      .replace(/__room_avatar__/g, room_avatar ?? '')
      .replace(/__room_type__/g, room_type ?? '')
  )
}
// To use if we want to verify email format
// const validEmailRe = /^\w[+.-\w]*\w@\w[.-\w]*\w\.\w{2,6}$/
const validMediums = ['email']

const redactAddress = (address: string): string => {
  const atIndex = address.indexOf('@')
  if (atIndex === -1) {
    throw new Error('Invalid address: missing @ symbol')
  }
  const localPart = address.slice(0, atIndex)
  const domainPart = address.slice(atIndex + 1)

  const replaceRandomCharacters = (
    str: string,
    redactionRatio: number
  ): string => {
    const chars = str.split('')
    const redactionCount = Math.ceil(chars.length * redactionRatio)

    for (let i = 0; i < redactionCount; i++) {
      const index = i * Math.floor(chars.length / redactionCount)
      chars[index] = '*'
    }

    return chars.join('')
  }

  const redactionRatio = 0.3 // Redact 30% of the characters
  const redactedLocalPart = replaceRandomCharacters(localPart, redactionRatio)
  const redactedDomainPart = replaceRandomCharacters(domainPart, redactionRatio)

  return `${redactedLocalPart}@${redactedDomainPart}`
}

export const storeInvitation = (
  idServer: MatrixIdentityServer
): expressAppHandler => {
  const transport = new Mailer(idServer.conf)
  const verificationTemplate = preConfigureTemplate(
    fs
      .readFileSync(`${idServer.conf.template_dir}/3pidInvitation.tpl`)
      .toString(),
    idServer.conf,
    transport
  )
  return (req, res) => {
    idServer.authenticate(req, res, (_data, _id) => {
      jsonContent(req, res, idServer.logger, (obj) => {
        validateParameters(res, schema, obj, idServer.logger, (obj) => {
          // TO DO : check for terms not signed
          if (!validMediums.includes((obj as storeInvitationArgs).medium)) {
            send(
              res,
              400,
              errMsg('unrecognized', 'This medium is not supported.')
            )
          } else {
            const _address = (obj as storeInvitationArgs).address

            // Call to the lookup API to check for any existing third-party identifiers
            const authHeader = req.headers.authorization ?? ''
            const validToken = authHeader.split(' ')[1]
            const _pepper = idServer.db.get('keys', ['data'], {
              name: 'pepper'
            })
            fetch(
              `https://${idServer.conf.server_name}/_matrix/identity/v2/lookup`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${validToken}`,
                  Accept: 'application/json',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  addresses: [_address],
                  algorithm: 'sha256',
                  pepper: _pepper
                })
              }
            )
              .then((response) => {
                if (response.status === 200) {
                  send(res, 400, {
                    errcode: 'M_THREEPID_IN_USE',
                    error:
                      'The third party identifier is already in use by another user.',
                    mxid: (obj as storeInvitationArgs).sender
                  })
                } else if (response.status === 400) {
                  const sid = randomString(64)
                  idServer.db
                    .createKeypair('shortTerm', 'curve25519')
                    .then((ephemeralKey) => {
                      idServer.db
                        .createOneTimeToken(
                          // TO DO : put the right parameters
                          { sid, email: _address },
                          idServer.conf.mail_link_delay
                        )
                        .then((_token) => {
                          // TO DO : add the invitation to the database
                          const invitation: storeInvitationArgs =
                            obj as storeInvitationArgs
                          idServer.db
                            .insert('invitations', {
                              address: invitation.address,
                              medium: invitation.medium,
                              room_id: invitation.room_id,
                              room_alias: invitation.room_alias ?? '',
                              room_avatar_url: invitation.room_avatar_url ?? '',
                              room_join_rule: invitation.room_join_rules ?? '',
                              room_name: invitation.room_name ?? '',
                              room_type: invitation.room_type ?? '',
                              sender: invitation.sender,
                              sender_avatar_url:
                                invitation.sender_avatar_url ?? '',
                              sender_display_name:
                                invitation.sender_display_name ?? ''
                            })
                            .then(() => {
                              // send email
                              void transport.sendMail({
                                to: _address,
                                raw: mailBody(
                                  verificationTemplate,
                                  (obj as storeInvitationArgs)
                                    .sender_display_name ?? '', // TO DO : handle case where sender_display_name is undefined
                                  _address,
                                  (obj as storeInvitationArgs).room_name,
                                  (obj as storeInvitationArgs).room_avatar_url,
                                  (obj as storeInvitationArgs).room_type
                                )
                              })
                              // send 200 response
                              const redactedAddress = redactAddress(_address)
                              const responseBody = {
                                display_name: redactedAddress,
                                public_keys: [
                                  {
                                    key_validity_url: `https://${idServer.conf.server_name}/_matrix/identity/v2/pubkey/isvalid`,
                                    // TO DO : adapt to changes
                                    public_key: ephemeralKey.publicKey
                                  },
                                  {
                                    key_validity_url: `https://${idServer.conf.server_name}/_matrix/identity/v2/pubkey/ephemeral/isvalid`,
                                    // TO DO : adapt to changes
                                    public_key: ephemeralKey.privateKey
                                  }
                                ],
                                token: _token
                              }
                              send(res, 200, responseBody)
                            })
                            .catch((e) => {
                              throw e
                            })
                        })
                        .catch((e) => {
                          throw e
                        })
                    })
                    .catch((e) => {
                      throw e
                    })
                } else {
                  send(
                    res,
                    500,
                    errMsg(
                      'unknown',
                      'Wrong behaviour of the /_matrix/identity/v2/lookup API'
                    )
                  )
                }
              })
              .catch((e) => {
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', e))
              })
          }
        })
      })
    })
  }
}
