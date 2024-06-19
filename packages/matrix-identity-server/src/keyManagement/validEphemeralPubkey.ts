import type IdentityServerDB from '../db'
import { type Request } from 'express'
import { send, type expressAppHandler } from '../utils'
import { errMsg } from '../utils/errors'

const isEphemeralPubkeyValid = (
  idServer: IdentityServerDB
): expressAppHandler => {
  return (req, res) => {
    const publicKey = (req as Request).query.public_key
    console.log('publicKey ephemeral:', publicKey)
    if (
      publicKey !== undefined &&
      typeof publicKey === 'string' &&
      publicKey.length > 0
    ) {
      idServer.db
        .get('shortTermKeypairs', ['public'], {
          public: publicKey
        })
        .then((rows) => {
          if (rows.length === 0) {
            send(res, 200, { valid: false })
          } else {
            // TO DO : ensure that the pubkey only appears one time
            send(res, 200, { valid: true })
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', e))
        })
    } else {
      send(res, 400, errMsg('missingParams'))
    }
  }
}

export default isEphemeralPubkeyValid
