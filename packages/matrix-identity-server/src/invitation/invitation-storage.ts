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
import { template } from 'lodash'
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
      .replace(/__multipart_boundary__/g, mb)
      // prepare link
      .replace(/__link__/g, `${baseUrl}?__linkQuery__`)
  )
}

const mailBody = (
  template: string,
  inviter_name: string,
  room_name?: string,
  room_avatar?: string,
  room_type?: string
): string => {
  return template
  // TO DO
}

const validEmailRe = /^\w[+.-\w]*\w@\w[.-\w]*\w\.\w{2,6}$/
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
      .readFileSync(`${idServer.conf.template_dir}/mailVerification.tpl`)
      .toString(),
    idServer.conf,
    transport
  )
  return async (req, res) => {
    idServer.authenticate(req, res, async (_data, _id) => {
      jsonContent(req, res, idServer.logger, async (obj) => {
        validateParameters(res, schema, obj, idServer.logger, async (obj) => {
          let _address = (obj as storeInvitationArgs).address
          if (!validEmailRe.test(_address)) {
            send(res, 400, errMsg('invalidEmail'))
            return
          } else {
            const randomToken = randomString(32)
            // TO DO : adapt this, change to :  idServer.db.createKeypair('shortTern', 'curve25519').then(...)
            //const ephemeralKey = generateKeyPair('ed25519')
            // TO DO : check for terms not signed
            if (!validMediums.includes((obj as storeInvitationArgs).medium)) {
              send(
                res,
                400,
                errMsg('unrecognized', 'This medium is not supported.')
              )
              return
            }
            // Call to the lookup API to check for any existing third-party identifiers
            const authHeader = req.headers.authorization || ''
            const validToken = authHeader.split(' ')[1]
            const pepper = await idServer.db.get('keys', ['data'], {
              name: 'pepper'
            })
            fetch(encodeURI(`https://${idServer}/_matrix/identity/v2/lookup`), {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${validToken}`,
                Accept: 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                addresses: [_address],
                algorithm: 'sha256',
                pepper: pepper
              })
            })
              .then((response) => {
                if (response.status === 200) {
                  send(res, 400, {
                    errcode: 'M_THREEPID_IN_USE',
                    error:
                      'The third party identifier is already in use by another user.',
                    mxid: (obj as storeInvitationArgs).sender
                  })
                } else if (response.status === 400) {
                  // add the invitation to the database
                  // send email
                  void transport.sendMail({
                    to: _address,
                    raw: mailBody(
                      verificationTemplate,
                      (obj as storeInvitationArgs).sender_display_name || '',
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
                        key_validity_url: `https://${idServer}/_matrix/identity/v2/pubkey/isvalid`
                        // TO DO : adapt to changes
                        //public_key: ephemeralKey.publicKey
                      },
                      {
                        key_validity_url: `https://${idServer}/_matrix/identity/v2/pubkey/ephemeral/isvalid`
                        // TO DO : adapt to changes
                        //public_key: ephemeralKey.privateKey
                      }
                    ],
                    token: randomToken
                  }
                  send(res, 200, responseBody)
                } /* istanbul ignore next */ else {
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
