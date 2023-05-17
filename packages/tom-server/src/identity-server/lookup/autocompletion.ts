import { errMsg, Utils } from '@twake/matrix-identity-server'
import { type expressAppHandler } from '../../types'
import type TwakeServer from '../..'

const schema = {
  scope: true,
  fields: false,
  val: true
}

export const SearchFields = new Set<string>(['mail', 'mobile', 'uid'])

export interface Query {
  scope: string[]
  fields?: string[]
  val: string
}

const autocompletion = (tomServer: TwakeServer): expressAppHandler => {
  return (req, res) => {
    tomServer.idServer.authenticate(req, res, (token, id) => {
      Utils.jsonContent(req, res, (obj) => {
        Utils.validateParameters(res, schema, obj, (data) => {
          const sendError = (e: string): void => {
            /* istanbul ignore next */
            console.error('Autocompletion error', e)
            /* istanbul ignore next */
            Utils.send(res, 500, errMsg('unknown', e))
          }
          let fields = (data as Query).fields
          let scope = (data as Query).scope
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
            tomServer.idServer.userDB
              .match('users', [...fields, 'uid'], scope, (data as Query).val)
              .then((rows) => {
                const mUid = rows.map((v) => {
                  return `@${v.uid as string}:${tomServer.conf.server_name}`
                })
                /**
                 * For the record, this can be replaced by a call to
                 * <matrix server>/_matrix/app/v1/users/{userId}
                 *
                 * See https://spec.matrix.org/v1.6/application-service-api/#get_matrixappv1usersuserid
                 */
                tomServer.matrixDb
                  .get('users', ['*'], 'name', mUid)
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
                      if (mUids[row.uid as string]) {
                        matches.push(row)
                      } else {
                        inactive_matches.push(row)
                      }
                    })
                    Utils.send(res, 200, { matches, inactive_matches })
                  })
                  .catch(sendError)
              })
              .catch(sendError)
          } else {
            Utils.send(res, 400, errMsg('invalidParam'))
          }
        })
      })
    })
  }
}

export default autocompletion
