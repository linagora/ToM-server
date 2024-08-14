import { type TwakeLogger } from '@twake/logger'
import { type tokenContent } from '@twake/matrix-identity-server'
import { epoch, errMsg, getAccessToken, send } from '@twake/utils'
import fetch from 'node-fetch'
import type { AuthenticationFunction, Config, TwakeDB } from '../../types'

export interface WhoAmIResponse {
  user_id?: string
  is_guest?: string
  device_id?: string
}

const Authenticate = (
  db: TwakeDB,
  conf: Config,
  logger: TwakeLogger
): AuthenticationFunction => {
  return (req, res, callback) => {
    const token = getAccessToken(req)
    if (token != null) {
      db.get('matrixTokens', ['data'], { id: token })
        .then((rows) => {
          if (rows.length === 0) {
            throw Error()
          }
          callback(JSON.parse(rows[0].data as string), token)
        })
        .catch((e) => {
          // Try to get token from matrix
          fetch(
            `https://${conf.matrix_server}/_matrix/client/r0/account/whoami`,
            {
              headers: {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                Authorization: `Bearer ${token}`
              }
            }
          )
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            .then((res) => res.json())
            .then((userInfo) => {
              const uid = (userInfo as WhoAmIResponse).user_id
              /* istanbul ignore else */
              if (uid != null) {
                const data: tokenContent = {
                  sub: uid,
                  epoch: epoch()
                }
                // STORE
                db.insert('matrixTokens', {
                  // eslint-disable-next-line n/no-callback-literal
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                  // @ts-ignore token is defined
                  id: token,
                  data: JSON.stringify(data)
                }).catch((e) => {
                  /* istanbul ignore next */
                  logger.error('Unable to insert a token', e)
                })
                // eslint-disable-next-line n/no-callback-literal
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                // @ts-ignore token is defined
                callback(data, token)
              } else {
                logger.warn('Bad token', userInfo)
                send(res, 401, errMsg('unAuthorized'))
              }
            })
            .catch((e) => {
              /* istanbul ignore next */
              logger.debug('Fetch error', e)
              /* istanbul ignore next */
              send(res, 401, errMsg('unAuthorized'))
            })
        })
    } else {
      logger.warn('Access tried without token', req.headers)
      send(res, 401, errMsg('unAuthorized'))
    }
  }
}

export default Authenticate
