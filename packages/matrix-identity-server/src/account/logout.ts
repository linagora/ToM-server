import type IdentityServerDb from '../db'
import { Authenticate, send, type expressAppHandler } from '../utils'
import { type tokenContent } from './register'

const Logout = (db: IdentityServerDb): expressAppHandler => {
  const delToken = db.prepare('DELETE FROM tokens WHERE id=?')
  /* istanbul ignore if */
  if (delToken == null) {
    throw new Error("Don't instanciate API before server is ready")
  }
  const authenticate = Authenticate(db)
  return (req, res) => {
    authenticate(req, res, (idToken: tokenContent, id?: string) => {
      delToken.run(id)
      delToken.finalize()
      send(res, 200, {})
    })
  }
}

export default Logout
