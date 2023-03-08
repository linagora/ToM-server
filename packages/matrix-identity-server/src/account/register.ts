import { type expressAppHandler, jsonContent, validateParameters, send } from '../utils'
import { randomString } from '../utils/tokenUtils'

const schema = {
  access_token: true,
  expires_in: true,
  matrix_server_name: true,
  token_type: true
}

const register: expressAppHandler = (req, res) => {
  jsonContent(req, res, (obj) => {
    validateParameters(res, schema, obj, (obj) => {
      // TODO: validate token
      const token = randomString(64)
      // TODO: store token in DB
      send(res, 200, { token })
    })
  })
}

export default register
