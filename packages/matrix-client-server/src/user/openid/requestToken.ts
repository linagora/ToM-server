import {
  epoch,
  errMsg,
  isMatrixIdValid,
  send,
  type expressAppHandler
} from '@twake/utils'
import type MatrixClientServer from '../..'
import { randomString } from '@twake/crypto'
import { type DbGetResult } from '@twake/matrix-identity-server'

interface Parameters {
  userId: string
}

export const insertOpenIdToken = async (
  clientServer: MatrixClientServer,
  userId: string,
  token: string
): Promise<DbGetResult> => {
  return await clientServer.matrixDb.insert('open_id_tokens', {
    token,
    user_id: userId,
    ts_valid_until_ms: epoch() + clientServer.conf.open_id_token_lifetime
  })
}

const requestToken = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data) => {
      // @ts-expect-error req has params
      const userId = (req.params as Parameters).userId
      if (!isMatrixIdValid(userId)) {
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
          'The access token provided does not correspond to the userId sent in the request parameters.'
        )
        send(res, 403, errMsg('forbidden'), clientServer.logger)
        return
      }
      const accessToken = randomString(64)
      insertOpenIdToken(clientServer, userId, accessToken)
        .then(() => {
          send(
            res,
            200,
            {
              access_token: accessToken,
              expires_in: clientServer.conf.open_id_token_lifetime,
              matrix_server_name: clientServer.conf.server_name,
              token_type: 'Bearer'
            },
            clientServer.logger
          )
        })
        .catch((e) => {
          // istanbul ignore next
          clientServer.logger.error('Error while inserting open_id_token', e)
          // istanbul ignore next
          send(res, 500, e, clientServer.logger)
        })
    })
  }
}

export default requestToken
