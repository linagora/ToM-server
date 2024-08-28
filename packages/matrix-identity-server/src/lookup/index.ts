import type MatrixIdentityServer from '..'
import {
  errMsg,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake/utils'

const schema = {
  addresses: true,
  algorithm: false,
  pepper: false
}

export const lookup3pid = async <T extends string = never>(
  idServer: MatrixIdentityServer<T>,
  obj: { addresses: string[] }
): Promise<Array<Record<string, string>>> => {
  const rows = await idServer.db.get('hashes', ['value', 'hash', 'active'], {
    hash: obj.addresses
  })
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
  return [mappings, inactives]
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
            lookup3pid(idServer, obj as { addresses: string[] })
              .then((result) => {
                if (idServer.conf.additional_features ?? false) {
                  send(res, 200, {
                    mappings: result[0],
                    inactive_mappings: result[1]
                  })
                } else {
                  send(res, 200, { mappings: result[0] })
                }
              })
              .catch((e) => {
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', e.toString()))
              })
          }
        })
      })
    })
  }
}

export default lookup
