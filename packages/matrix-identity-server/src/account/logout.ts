import { Authenticate, send, type expressAppHandler } from '../utils'
import { type Database } from 'sqlite3'
import { type tokenContent } from './register'

const Logout = (db: Database): expressAppHandler => {
  const delToken = db.prepare('DELETE FROM tokens WHERE id=?')
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
