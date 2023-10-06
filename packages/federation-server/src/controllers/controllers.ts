import { supportedHashes } from '@twake/crypto'
import { MatrixErrors } from '@twake/matrix-identity-server'
import { FederationServerError } from '../middlewares/errors'
import {
  type IdentityServerDb,
  type expressAppHandler
} from '../types'

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
