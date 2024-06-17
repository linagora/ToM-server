import type MatrixIdentityServer from '..'
import {
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '../utils'
import { errMsg } from '../utils/errors'

const schema = {
  keyID: true
}

const getPubkey = (idServer: MatrixIdentityServer): expressAppHandler => {
  return (req, res) => {
    jsonContent(req, res, idServer.logger, (obj) => {
      validateParameters(res, schema, obj, idServer.logger, (obj) => {
        idServer.logger.debug(`request to search ${JSON.stringify(obj)}`)
        idServer.db
          .get('shortTermKeypairs', ['public'], {
            keyID: (obj as { _keyID: string })._keyID
          })
          .then((rows) => {
            if (rows.length === 0) {
              idServer.db
                .get('longTermKeypairs', ['public'], {
                  keyID: (obj as { _keyID: string })._keyID
                })
                .then((rows) => {
                  if (rows.length === 0) {
                    send(res, 404, errMsg('notFound'))
                  } else {
                    // On verifie ailleurs que la clef publique n'apparait bien qu'une seule fois !
                    send(res, 200, { public_key: rows[0].public })
                  }
                })
                .catch((e) => {
                  /* istanbul ignore next */
                  send(res, 500, errMsg('unknown', e))
                })
              send(res, 404, errMsg('notFound'))
            } else {
              // On verifie ailleurs que la clef publique n'apparait bien qu'une seule fois !
              send(res, 200, { public_key: rows[0].public })
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

export default getPubkey
