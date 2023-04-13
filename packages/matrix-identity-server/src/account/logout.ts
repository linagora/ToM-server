import type IdentityServerDb from '../db'
import { Authenticate, send, type expressAppHandler } from '../utils'
import { errMsg } from '../utils/errors'
import { type tokenContent } from './register'

const Logout = (db: IdentityServerDb): expressAppHandler => {
  const authenticate = Authenticate(db)
  return (req, res) => {
    // @ts-expect-error id is defined here
    authenticate(req, res, (idToken: tokenContent, id: string) => {
      db.deleteEqual('accessTokens', 'id', id)
        .then(() => {
          send(res, 200, {})
        })
        .catch((e) => {
          /* istanbul ignore next */
          console.warn(`Unable to delete token ${id}`, e)
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', 'Unable to delete session'))
        })
    })
  }
}

export default Logout
