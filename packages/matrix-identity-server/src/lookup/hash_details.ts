import { supportedHashes } from '@twake/crypto'
import type MatrixIdentityServer from '..'
import { errMsg, send, type expressAppHandler } from '@twake/utils'

const hashDetails = <T extends string = never>(
  idServer: MatrixIdentityServer<T>
): expressAppHandler => {
  return (req, res) => {
    idServer.authenticate(req, res, (tokenContent, id) => {
      idServer.db
        .get('keys', ['data'], { name: 'pepper' })
        .then((rows) => {
          send(res, 200, {
            algorithms: supportedHashes,
            lookup_pepper: rows[0].data
          })
        })
        .catch((e) => {
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', e.toString()))
        })
    })
  }
}

export default hashDetails
