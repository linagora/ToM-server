import { randomString } from '@twake/crypto'
import type IdentityServerDb from '../db'
import {
  epoch,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '../utils'
import { errMsg } from '../utils/errors'
import validateMatrixToken from '../utils/validateMatrixToken'
import { TwakeLogger } from '@twake/logger'

const schema = {
  access_token: true,
  expires_in: true,
  matrix_server_name: true,
  token_type: true
}

type registerArgs = Record<keyof typeof schema, string>

export interface tokenContent {
  sub: string
  epoch: number
}

const Register = (
  db: IdentityServerDb,
  logger: TwakeLogger
): expressAppHandler => {
  const validateToken = validateMatrixToken(logger)
  return (req, res) => {
    jsonContent(req, res, db.logger, (obj) => {
      validateParameters(res, schema, obj, db.logger, (obj) => {
        validateToken(
          (obj as registerArgs).matrix_server_name,
          (obj as registerArgs).access_token
        )
          .then((sub) => {
            const data: tokenContent = {
              sub,
              epoch: epoch()
            }
            const token = randomString(64)
            db.insert('accessTokens', {
              id: token,
              data: JSON.stringify(data)
            })
              .then(() => {
                logger.info(
                  `${req.socket.remoteAddress} successfully registered`
                )
                send(res, 200, { token })
              })
              .catch((e) => {
                /* istanbul ignore next */
                logger.error('Unable to create session', e)
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', 'Unable to create session'))
              })
          })
          .catch((e) => {
            logger.warn(`Unable to validate token ${JSON.stringify(obj)}`, e)

            /* TODO: Matrix spec doesn't describe response to use it, check later if fixed */
            send(res, 401, errMsg('sessionNotValidated', e))
          })
      })
    })
  }
}

export default Register
