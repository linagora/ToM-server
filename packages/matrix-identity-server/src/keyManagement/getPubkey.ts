import type IdentityServerDB from '../db'
import { type Request } from 'express'
import { send, type expressAppHandler } from '../utils'
import { errMsg } from '../utils/errors'

const getPubkey = (idServer: IdentityServerDB): expressAppHandler => {
  return (req, res) => {
    const _keyID: string = (req as Request).params.keyId

    if (_keyID === undefined || typeof _keyID !== 'string') {
      send(res, 400, errMsg('missingParams'))
      return
    }

    idServer.db
      .get('shortTermKeypairs', ['public'], { keyID: _keyID })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((rows) => {
        if (rows.length === 1) {
          send(res, 200, { public_key: rows[0].public })
        } else {
          return idServer.db
            .get('longTermKeypairs', ['public'], { keyID: _keyID })
            .then((rows) => {
              if (rows.length === 0) {
                send(
                  res,
                  404,
                  errMsg('notFound', 'The public key was not found')
                )
              } else {
                send(res, 200, { public_key: rows[0].public })
              }
            })
        }
      })
      .catch((e) => {
        console.error('Error querying keypairs:', e) // Debugging statement
        /* istanbul ignore next */
        send(res, 500, errMsg('unknown', e))
      })
  }
}

export default getPubkey
