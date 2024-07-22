import { epoch, errMsg, send, type expressAppHandler } from '@twake/utils'
import type MatrixClientServer from '../..'
import { randomString } from '@twake/crypto'

interface Parameters {
  userId: string
}

interface ResponseBody {
  access_token: string
  expires_in: number
  matrix_server_name: string
  token_type: string
}
const matrixIdRegex = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/

const requestToken = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data) => {
      // @ts-expect-error req has params
      const userId = (req.params as Parameters).userId
      if (!matrixIdRegex.test(userId)) {
        send(
          res,
          400,
          errMsg('invalidParam', 'Invalid user ID'),
          clientServer.logger
        )
        return
      }
      if (userId !== data.sub) {
        clientServer.logger.error(
          'Your access token does not correspond to the userId sent in the request parameters.'
        )
        send(res, 403, errMsg('forbidden'), clientServer.logger)
        return
      }
      const responseBody: ResponseBody = {
        access_token: randomString(64),
        expires_in: 64000, // TODO : Put expiry time in the config
        matrix_server_name: clientServer.conf.server_name,
        token_type: 'Bearer'
      }
      clientServer.matrixDb
        .insert('open_id_tokens', {
          token: responseBody.access_token,
          user_id: userId,
          ts_valid_until_ms: epoch() + responseBody.expires_in
        })
        .then(() => {
          send(res, 200, responseBody, clientServer.logger)
        })
        .catch((e) => {
          clientServer.logger.error('Error while inserting open_id_token', e)
          send(res, 500, e, clientServer.logger)
        })
    })
  }
}

export default requestToken
