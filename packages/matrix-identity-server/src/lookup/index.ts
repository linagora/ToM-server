import type MatrixIdentityServer from '..'
import {
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '../utils'
import { errMsg } from '../utils/errors'

const schema = {
  addresses: true,
  algorithm: false,
  pepper: false
}

const lookup = (idServer: MatrixIdentityServer): expressAppHandler => {
  return (req, res) => {
    idServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, idServer.logger, (obj) => {
        validateParameters(res, schema, obj, idServer.logger, (obj) => {
          if (typeof (obj as { addresses: string[] }).addresses !== 'object') {
            /* istanbul ignore next */
            send(res, 400, errMsg('invalidParam'))
          } else {
            idServer.db
              .get('hashes', ['value', 'hash', 'active'], {
                hash: (obj as { addresses: string[] }).addresses
              })
              .then((rows) => {
                // send(res, 200, rows)
                const mappings: Record<string, string> = {}
                const inactives: Record<string, string> = {}
                rows.forEach((row) => {
                  if (row.active === 1) {
                    // @ts-expect-error row.hash is not null
                    mappings[row.hash] = row.value
                  } else {
                    // @ts-expect-error row.hash is not null
                    inactives[row.hash] = row.value
                  }
                })
                if (idServer.conf.additional_features ?? false) {
                  send(res, 200, { mappings, inactive_mappings: inactives })
                } else {
                  send(res, 200, { mappings })
                }
              })
              .catch((e) => {
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', e))
              })
          }
        })
      })
    })
  }
}

export default lookup
