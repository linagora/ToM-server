import { type Request } from 'express'
import type IdentityServerDB from '../db'
import { errMsg, send, type expressAppHandler } from '@twake/utils'

const isPubkeyValid = <T extends string = never>(
  idServer: IdentityServerDB<T>
): expressAppHandler => {
  return (req, res) => {
    const publicKey = (req as Request).query.public_key
    if (
      publicKey !== undefined &&
      typeof publicKey === 'string' &&
      publicKey.length > 0
    ) {
      idServer.db
        .get('longTermKeypairs', ['public'], {
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

export default isPubkeyValid
