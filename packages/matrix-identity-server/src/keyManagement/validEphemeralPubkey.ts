import type IdentityServerDB from '../db'
import { type TwakeLogger } from '@twake/logger'
import {
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '../utils'
import { errMsg } from '../utils/errors'

const schema = {
  public_key: true
}

const isEphemeralPubkeyValid = (
  idServer: IdentityServerDB,
  logger: TwakeLogger
): expressAppHandler => {
  return (req, res) => {
    jsonContent(req, res, logger, (obj) => {
      validateParameters(res, schema, obj, logger, (obj) => {
        logger.debug(`request to search ${JSON.stringify(obj)}`)
        idServer.db
          .get('shortTermKeypairs', ['public'], {
            public: (obj as { public_key: string }).public_key
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
      })
    })
  }
}

export default isEphemeralPubkeyValid
