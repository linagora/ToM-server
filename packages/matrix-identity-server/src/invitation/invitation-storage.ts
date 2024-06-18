import { randomString, generateKeyPair } from '@twake/crypto'
import {
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '../utils'
import { errMsg } from '../utils/errors'
import { template } from 'lodash'
import type MatrixIdentityServer from '../../index'

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

const redactAddress = (address: string): string => {
  const atIndex = address.indexOf('@')
  if (atIndex === -1) {
    throw new Error('Invalid address: missing @ symbol')
  }
  const localPart = address.slice(0, atIndex)
  const domainPart = address.slice(atIndex)

  const replaceRandomCharacters = (str: string): string => {
    const chars = str.split('')
    for (let i = 0; i < chars.length; i++) {
      if (Math.random() < 0.3) {
        chars[i] = '*'
      }
    }
    return chars.join('')
  }

  const redactedLocalPart = replaceRandomCharacters(localPart)
  const redactedDomainPart = replaceRandomCharacters(domainPart)

  return `${redactedLocalPart}${redactedDomainPart}`
}

export const storeInvitation = (
  idServer: MatrixIdentityServer
): expressAppHandler => {
  // TO DO : implementation du mail a faire

  return (req, res) => {
    idServer.authenticate(req, res, (_data, _id) => {
      jsonContent(req, res, idServer.logger, (obj) => {
        validateParameters(res, schema, obj, idServer.logger, (obj) => {
          // check if user has to do smth to use following API : 403 : M_TERMS_NOT_SIGNED
          const randomToken = randomString(32)
          const ephemeralKey = generateKeyPair('ed25519')
          // Ajouter la clef dans la base de donnée
          let _adress = (obj as storeInvitationArgs).address
          // Check if 3pid is already associated with matrix user ID -> 400 : M_THREEPID_IN_USE
          // check if medium is valid (email) -> 400 : M_UNRECOGNIZED

          display_name = redactAddress(display_name)
        })
      })
    })
  }
}
