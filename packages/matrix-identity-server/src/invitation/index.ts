import { randomString } from '@twake/crypto'
import fs from 'fs'
import fetch from 'node-fetch'
import type MatrixIdentityServer from '../index'
import { type Config } from '../types'
import {
  errMsg,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake/utils'
import Mailer from '../utils/mailer'

interface storeInvitationArgs {
  address: string
  phone: string
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
  address: false,
  phone: false,
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
  return (
    template
      // initialize "From"
      .replace(/__from__/g, transport.from)
      // fix multipart stuff
      .replace(/__multipart_boundary__/g, mb)
  )
}

// TODO : modify this if necessary
const inviteLink = (
  server: string,
  senderId: string,
  roomAlias?: string
): string => {
  if (roomAlias != null) {
    return `https://${server}/#/${roomAlias}`
  } else {
    return `https://${server}/#/${senderId}`
  }
}

const mailBody = (
  template: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  inviter_name: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  sender_user_id: string,
  dst: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  room_name: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  room_avatar: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  room_type: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  server_name_creating_invitation: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  room_alias?: string
): string => {
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
      .replace(/__room_name__/g, room_name)
      .replace(/__room_avatar__/g, room_avatar)
      .replace(/__room_type__/g, room_type)
      .replace(
        /__link__/g,
        inviteLink(server_name_creating_invitation, sender_user_id, room_alias)
      )
  )
}

// To complete if another 3PID is added for this endpoint
const validMediums: string[] = ['email', 'msisdn']

// Regular expressions for different mediums
const validEmailRe = /^\w[+.-\w]*\w@\w[.-\w]*\w\.\w{2,6}$/
const validPhoneRe = /^\d{4,16}$/

const redactAddress = (medium: string, address: string): string => {
  switch (medium) {
    case 'email': {
      const atIndex = address.indexOf('@')
      const localPart = address.slice(0, atIndex)
      const domainPart = address.slice(atIndex + 1)

      const redactedLocalPart = replaceLastCharacters(localPart)
      const redactedDomainPart = replaceLastCharacters(domainPart)

      return `${redactedLocalPart}@${redactedDomainPart}`
    }
    case 'msisdn':
      return replaceLastCharacters(address)
    /* istanbul ignore next : call to redactAddress is done after checking if the medium was valid */
    default:
      return address
  }
}

const replaceLastCharacters = (
  str: string,
  redactionRatio: number = 0.4
): string => {
  const chars = str.split('')
  const redactionCount = Math.ceil(chars.length * redactionRatio)

  // Replace the last `redactionCount` characters with '*'
  for (let i = chars.length - redactionCount; i < chars.length; i++) {
    chars[i] = '*'
  }

  return chars.join('')
}

const StoreInvit = <T extends string = never>(
  idServer: MatrixIdentityServer<T>
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
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        validateParameters(res, schema, obj, idServer.logger, async (obj) => {
          const medium = (obj as storeInvitationArgs).medium
          if (!validMediums.includes(medium)) {
            send(
              res,
              400,
              errMsg('unrecognized', 'This medium is not supported.')
            )
            return
          }
          const address = (obj as storeInvitationArgs).address
          const phone = (obj as storeInvitationArgs).phone
          let mediumAddress: string = ''
          // Check the validity of the media
          switch (medium) {
            case 'email':
              if (address == null || !validEmailRe.test(address)) {
                send(res, 400, errMsg('invalidParam', 'Invalid email address.'))
                return
              } else mediumAddress = address
              break
            case 'msisdn':
              if (phone == null || !validPhoneRe.test(phone)) {
                send(res, 400, errMsg('invalidParam', 'Invalid phone number.'))
                return
              } else mediumAddress = phone
              break
          }
          // Call to the lookup API to check for any existing third-party identifiers
          try {
            const authHeader = req.headers.authorization as string
            const validToken = authHeader.split(' ')[1]
            const _pepper = idServer.db.get('keys', ['data'], {
              name: 'pepper'
            })
            const response = await fetch(
              `https://${idServer.conf.server_name}/_matrix/identity/v2/lookup`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${validToken}`,
                  Accept: 'application/json',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  addresses: [mediumAddress],
                  algorithm: 'sha256',
                  pepper: _pepper
                })
              }
            )
            if (response.status === 200) {
              send(res, 400, {
                errcode: 'M_THREEPID_IN_USE',
                error:
                  'The third party identifier is already in use by another user.',
                mxid: (obj as storeInvitationArgs).sender
              })
            } else if (response.status === 400) {
              // Create invitation token
              const ephemeralKey = await idServer.db.createKeypair(
                'shortTerm',
                'curve25519'
              )
              const objWithKey = {
                ...(obj as storeInvitationArgs),
                key: ephemeralKey
              }
              const token = await idServer.db.createInvitationToken(
                mediumAddress,
                objWithKey
              )
              // Send email/sms
              switch (medium) {
                case 'email':
                  void transport.sendMail({
                    to: address,
                    raw: mailBody(
                      verificationTemplate,
                      (obj as storeInvitationArgs).sender_display_name ??
                        '*****',
                      (obj as storeInvitationArgs).sender,
                      address,
                      (obj as storeInvitationArgs).room_name ?? '*****',
                      (obj as storeInvitationArgs).room_avatar_url ?? '*****',
                      (obj as storeInvitationArgs).room_type ?? '*****',
                      idServer.conf.invitation_server_name ?? 'matrix.to',
                      (obj as storeInvitationArgs).room_alias
                    )
                  })
                  break
                case 'msisdn':
                  // TODO implement smsSender
                  break
              }
              // Send 200 response
              const redactedAddress = redactAddress(medium, mediumAddress)
              idServer.db
                .getKeys('current')
                .then((keys) => {
                  const responseBody = {
                    display_name: redactedAddress,
                    public_keys: [
                      {
                        key_validity_url: `https://${idServer.conf.server_name}/_matrix/identity/v2/pubkey/isvalid`,
                        public_key: keys.publicKey
                      },
                      {
                        key_validity_url: `https://${idServer.conf.server_name}/_matrix/identity/v2/pubkey/ephemeral/isvalid`,
                        public_key: ephemeralKey.privateKey
                      }
                    ],
                    token
                  }
                  send(res, 200, responseBody)
                })
                .catch((err) => {
                  /* istanbul ignore next */
                  idServer.logger.debug(
                    'Error while getting the current key',
                    err
                  )
                  /* istanbul ignore next */
                  send(res, 500, errMsg('unknown', err))
                })
            } else {
              /* istanbul ignore next */
              idServer.logger.error(
                'Unexpected response statusCode from the /_matrix/identity/v2/lookup API'
              )
              send(
                res,
                500,
                errMsg(
                  'unknown',
                  'Unexpected response statusCode from the /_matrix/identity/v2/lookup API'
                )
              )
            }
          } catch (err) {
            /* istanbul ignore next */
            idServer.logger.error(
              'Error while making a call to the lookup API (/_matrix/identity/v2/lookup)',
              err
            )
            /* istanbul ignore next */
            send(res, 500, errMsg('unknown', err as string))
          }
        })
      })
    })
  }
}

export default StoreInvit
