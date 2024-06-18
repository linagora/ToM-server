import type IdentityServerDB from '../db'
import { type TwakeLogger, getLogger } from '@twake/logger'
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

const logger: TwakeLogger = getLogger()

const isEphemeralPubkeyValid = (
  idServer: IdentityServerDB
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
              // On verifie ailleurs que la clef publique n'apparait bien qu'une seule fois !
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
