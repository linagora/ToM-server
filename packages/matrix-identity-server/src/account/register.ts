import { type expressAppHandler, jsonContent, validateParameters, send, epoch } from '../utils'
import { randomString } from '../utils/tokenUtils'
import { type Database } from 'sqlite3'

const schema = {
  access_token: true,
  expires_in: true,
  matrix_server_name: true,
  token_type: true
}

const Register = (db: Database): expressAppHandler => {
  const insertToken = db.prepare('INSERT INTO tokens VALUES (?,?)')
  return (req, res) => {
    jsonContent(req, res, (obj) => {
      validateParameters(res, schema, obj, (obj) => {
        // TODO: validate token and get OIDC data
        const data = {
          sub: 'dwho',
          epoch: epoch()
        }
        const token = randomString(64)
        insertToken.run(token, JSON.stringify(data))
        send(res, 200, { token })
      })
    })
  }
}

export default Register
