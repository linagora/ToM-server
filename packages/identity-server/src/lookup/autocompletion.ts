import type IdentityServerDb from '@twake/matrix-identity-server/dist/db'
import { Utils, type expressAppHandler } from '..'
import type UserDB from '@twake/matrix-identity-server/dist/userdb'
import { errMsg } from '@twake/matrix-identity-server'

const schema = {
  scope: true,
  fields: false,
  val: true
}

export const SearchFields = new Set<string>(['mail', 'phone', 'uid'])

export interface Query {
  scope: string[]
  fields?: string[]
  val: string
}

const autocompletion = (
  db: IdentityServerDb,
  userDb: UserDB
): expressAppHandler => {
  const authenticate = Utils.Authenticate(db)
  return (req, res) => {
    authenticate(req, res, (token, id) => {
      Utils.jsonContent(req, res, (obj) => {
        Utils.validateParameters(res, schema, obj, (data) => {
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
            userDb
              .match('users', fields, scope, (data as Query).val)
              .then((rows) => {
                Utils.send(res, 200, { matches: rows })
              })
              .catch((e) => {
                /* istanbul ignore next */
                Utils.send(res, 500, errMsg('unknown', e))
              })
          } else {
            Utils.send(res, 400, errMsg('invalidParam'))
          }
        })
      })
    })
  }
}

export default autocompletion
