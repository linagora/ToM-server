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
  return (
    template
      // initialize "From"
      .replace(/__from__/g, transport.from)
      // fix multipart stuff
      .replace(/__multipart_boundary__/g, mb)
  )
}

const mailBody = (
  template: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  inviter_name: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  dst: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  room_name: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  room_avatar: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  room_type: string
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
      .replace(/__room_name__/g, room_name ?? '')
      .replace(/__room_avatar__/g, room_avatar ?? '')
      .replace(/__room_type__/g, room_type ?? '')
  )
}

const invitationDelay = 3155760000 // 100 years in seconds

// To complete if another 3PID is added for this endpoint
const validMediums: string[] = ['email']

// Regular expressions for different mediums
const validEmailRe = /^\w[+.-\w]*\w@\w[.-\w]*\w\.\w{2,6}$/

const redactAddress = (address: string): string => {
  // Assuming that the address is a valid email address
  const atIndex = address.indexOf('@')
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
        validateParameters(res, schema, obj, idServer.logger, async (obj) => {
          const _address = (obj as storeInvitationArgs).address
          const _medium = (obj as storeInvitationArgs).medium
          if (!validMediums.includes(_medium)) {
            send(
              res,
              400,
              errMsg('unrecognized', 'This medium is not supported.')
            )
            return
          }
          // Check the validity of the media
          switch (_medium) {
            case 'email':
              if (!validEmailRe.test(_address)) {
                send(res, 400, errMsg('invalidEmail'))
                return
              }
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
                  addresses: [_address],
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
              const ephemeralKey = await idServer.db.createKeypair(
                'shortTerm',
                'curve25519'
              )
              const objWithKey = {
                ...(obj as storeInvitationArgs),
                key: ephemeralKey
              }
              const _token = await idServer.db.createToken(
                objWithKey,
                invitationDelay
              )
              // send email
              void transport.sendMail({
                to: _address,
                raw: mailBody(
                  verificationTemplate,
                  (obj as storeInvitationArgs).sender_display_name ?? '*****',
                  _address,
                  (obj as storeInvitationArgs).room_name ?? '*****',
                  (obj as storeInvitationArgs).room_avatar_url ?? '*****',
                  (obj as storeInvitationArgs).room_type ?? '*****'
                )
              })
              // send 200 response
              const redactedAddress = redactAddress(_address)
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
                    token: _token
                  }
                  send(res, 200, responseBody)
                })
                .catch((e) => {
                  /* istanbul ignore next */
                  idServer.logger.debug(
                    'Error while getting the current key',
                    e
                  )
                  /* istanbul ignore next */
                  throw e
                })
            } else {
              send(
                res,
                500,
                errMsg(
                  'unknown',
                  'Unexpected response statusCode from the /_matrix/identity/v2/lookup API'
                )
              )
            }
          } catch (e) {
            /* istanbul ignore next */
            idServer.logger.debug(
              'Error while making a call to the lookup API (/_matrix/identity/v2/lookup)',
              e
            )
            /* istanbul ignore next */
            throw e
          }
        })
      })
    })
  }
}

export default StoreInvit
