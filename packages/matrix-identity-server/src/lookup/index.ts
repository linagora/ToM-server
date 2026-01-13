import type MatrixIdentityServer from '../index.ts'
import {
  errMsg,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake-chat/utils'

const schema = {
  addresses: true,
  algorithm: false,
  pepper: false
}

const lookup = <T extends string = never>(
  idServer: MatrixIdentityServer<T>
): expressAppHandler => {
  return (req, res) => {
    idServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, idServer.logger, (obj) => {
        validateParameters(res, schema, obj, idServer.logger, (obj) => {
          if (
            !(
              Array.isArray((obj as { addresses: string[] }).addresses) &&
              (obj as { addresses: string[] }).addresses.every(
                (address) => typeof address === 'string'
              ) &&
              (obj as { addresses: string[] }).addresses.length <=
                (idServer.conf.hashes_rate_limit as number)
            )
          ) {
            /* istanbul ignore next */
            send(res, 400, errMsg('invalidParam'))
          } else {
            idServer.logger.debug(
              `lookup request to search ${JSON.stringify(obj)}`
            )
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
