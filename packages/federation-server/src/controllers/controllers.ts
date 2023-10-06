import { supportedHashes } from '@twake/crypto'
import { MatrixErrors } from '@twake/matrix-identity-server'
import { hashByServer } from '../db'
import {
  FederationServerError,
  validationErrorHandler
} from '../middlewares/errors'
import { type IdentityServerDb, type expressAppHandler } from '../types'

export const lookups = (db: IdentityServerDb): expressAppHandler => {
  return (req, res, next) => {
    validationErrorHandler(req)
    const serverAddress = Object.keys(req.body.mappings)[0]
    const hashes = req.body.mappings[serverAddress] as Array<
      Record<string, string | number>
    >
    db.deleteEqual(hashByServer, 'server', serverAddress)
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((_) => {
        return Promise.all(
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          hashes.map((hash) =>
            db.insert(hashByServer, {
              hash: hash.hash,
              active: hash.active,
              server: serverAddress
            })
          )
        )
      })
      .then(() => {
        res.status(201).json({})
      })
      .catch((e) => {
        next(
          new FederationServerError({
            message: e,
            code: MatrixErrors.errCodes.unknown
          })
        )
      })
  }
}

export const hashDetails = (db: IdentityServerDb): expressAppHandler => {
  return (req, res, next) => {
    db.get('keys', ['data'], { name: 'pepper' })
      .then((rows) => {
        res.json({
          algorithms: supportedHashes,
          lookup_pepper: rows[0].data
        })
      })
      .catch((e) => {
        next(
          new FederationServerError({
            message: e,
            code: MatrixErrors.errCodes.unknown
          })
        )
      })
  }
}
