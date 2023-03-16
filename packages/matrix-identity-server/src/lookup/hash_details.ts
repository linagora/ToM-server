import { supportedHashes } from '@twake/crypto'
import type IdentityServerDb from '../db'
import { type expressAppHandler, send } from '../utils'
import { errMsg } from '../utils/errors'
import { Authenticate } from '../utils'

const hashDetails = (db: IdentityServerDb): expressAppHandler => {
  const authenticate = Authenticate(db)
  return (req, res) => {
    authenticate(req, res, (tokenContent, id) => {
      db.get('keys', ['data'], 'name', 'pepper').then(rows => {
        send(res, 200, {
          algorithms: supportedHashes,
          lookup_pepper: rows[0].data
        })
      }).catch(e => {
        /* istanbul ignore next */
        send(res, 500, errMsg('unknown', e))
      })
    })
  }
}

export default hashDetails
