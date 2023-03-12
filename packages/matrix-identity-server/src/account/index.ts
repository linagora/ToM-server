import type IdentityServerDb from '../db'
import { Authenticate, send, type expressAppHandler } from '../utils'
import { type tokenContent } from './register'

const Account = (db: IdentityServerDb): expressAppHandler => {
  const authenticate = Authenticate(db)
  return (req, res) => {
    authenticate(req, res, (idToken: tokenContent) => {
      send(res, 200, { user_id: idToken.sub })
    })
  }
}

export default Account
