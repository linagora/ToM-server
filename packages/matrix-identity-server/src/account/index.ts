import { Authenticate, jsonContent, send, validateParameters, type expressAppHandler } from '../utils'
import { type Database } from 'sqlite3'
import { type tokenContent } from './register'

const Account = (db: Database): expressAppHandler => {
  const authenticate = Authenticate(db)
  return (req, res) => {
    authenticate(req, res, (idToken: tokenContent) => {
      send(res, 200, { user_id: idToken.sub })
    })
  }
}

export default Account
