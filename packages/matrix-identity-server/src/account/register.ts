import { randomString } from '@twake-chat/crypto'
import { type TwakeLogger } from '@twake-chat/logger'
import type IdentityServerDb from '../db'
import {
  epoch,
  errMsg,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake-chat/utils'
import validateMatrixToken from '../utils/validateMatrixToken'

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

const Register = <T extends string = never>(
  db: IdentityServerDb<T>,
  logger: TwakeLogger
): expressAppHandler => {
  const validateToken = validateMatrixToken(logger)
  return (req, res) => {
    jsonContent(req, res, logger, (obj) => {
      validateParameters(res, schema, obj, logger, (obj) => {
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
                console.error('Unable to creation session', { e })
                /* istanbul ignore next */
                logger.error('Unable to create session', e)
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', 'Unable to create session'))
              })
          })
          .catch((e) => {
            console.error('unable to validate token', { e })
            logger.warn(`Unable to validate token ${JSON.stringify(obj)}`, e)
            send(res, 401, errMsg('sessionNotValidated', e))
          })
      })
    })
  }
}

export default Register
