import { type TwakeLogger } from '@twake/logger'
import { errMsg, Utils } from '@twake/matrix-identity-server'
import { type Response } from 'express'
import type http from 'http'
import type TwakeIdentityServer from '..'

type SearchFunction = (res: Response | http.ServerResponse, data: Query) => void

export interface Query {
  scope: string[]
  fields?: string[]
  limit?: number
  offset?: number
  val?: string
}

export const SearchFields = new Set<string>([
  'mail',
  'mobile',
  'uid',
  'displayName',
  'givenName',
  'cn',
  'sn',
  'matrixAddress'
])

const _search = (
  idServer: TwakeIdentityServer,
  logger: TwakeLogger
): SearchFunction => {
  return (res, data) => {
    const sendError = (e: string): void => {
      /* istanbul ignore next */
      logger.error('Autocompletion error', e)
      /* istanbul ignore next */
      Utils.send(res, 500, errMsg('unknown', e))
    }
    let fields = data.fields
    let scope = data.scope
    /* istanbul ignore if */
    if (fields == null) fields = []
    /* istanbul ignore if */
    if (typeof scope !== 'object') scope = [scope]
    let error = false
    fields.forEach((v) => {
      /* istanbul ignore next */
      if (!SearchFields.has(v)) error = true
    })
    scope.forEach((v) => {
      /* istanbul ignore next */
      if (!SearchFields.has(v)) error = true
    })
    /* istanbul ignore else */
    if (!error) {
      const _fields = fields.includes('uid') ? fields : [...fields, 'uid']
      const _scope = scope.map((f) => (f === 'matrixAddress' ? 'uid' : f))
      const value = data.val?.replace(/^@(.*?):(?:.*)$/, '$1')
      const request =
        typeof value === 'string' && value.length > 0
          ? idServer.userDB.match('users', _fields, _scope, value, _fields[0])
          : idServer.userDB.getAll('users', _fields, _fields[0])
      request
        .then((rows) => {
          if (rows.length === 0) {
            /* istanbul ignore next */
            Utils.send(res, 200, { matches: [], inactive_matches: [] })
          } else {
            const start = data.offset ?? 0
            const end = start + (data.limit ?? 30)
            rows = rows.slice(start, end)
            const mUid = rows.map((v) => {
              return `@${v.uid as string}:${idServer.conf.server_name}`
            })
            /**
             * For the record, this can be replaced by a call to
             * <matrix server>/_matrix/app/v1/users/{userId}
             *
             * See https://spec.matrix.org/v1.6/application-service-api/#get_matrixappv1usersuserid
             */
            idServer.matrixDb
              .get('users', ['*'], { name: mUid })
              .then((matrixRows) => {
                const mUids: Record<string, true> = {}
                const matches: typeof rows = []
                // eslint-disable-next-line @typescript-eslint/naming-convention
                const inactive_matches: typeof rows = []

                matrixRows.forEach((mrow) => {
                  mUids[
                    (mrow.name as string).replace(/^@(.*?):(?:.*)$/, '$1')
                  ] = true
                })
                rows.forEach((row) => {
                  row.address = `@${row.uid as string}:${
                    idServer.conf.server_name
                  }`
                  if (mUids[row.uid as string]) {
                    matches.push(row)
                  } else {
                    inactive_matches.push(row)
                  }
                })
                Utils.send(res, 200, { matches, inactive_matches })
              })
              .catch(sendError)
          }
        })
        .catch(sendError)
    } else {
      Utils.send(res, 400, errMsg('invalidParam'))
    }
  }
}

export default _search
