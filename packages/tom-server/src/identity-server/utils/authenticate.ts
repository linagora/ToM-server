import { errMsg, Utils, type tokenContent } from '@twake/matrix-identity-server'
import fetch from 'node-fetch'
import {
  type AuthenticationFunction,
  type Config,
  type IdentityServerDb
} from '../../types'

export interface WhoAmIResponse {
  user_id?: string
  is_guest?: string
  device_id?: string
}

const Authenticate = (
  db: IdentityServerDb,
  conf: Config
): AuthenticationFunction => {
  const tokenRe = /^Bearer (\S+)$/
  return (req, res, callback) => {
    let token: string | null = null
    if (req.headers?.authorization != null) {
      const re = req.headers.authorization.match(tokenRe)
      if (re != null) {
        token = re[1]
      }
      // @ts-expect-error req.query exists
    } else if (req.query != null) {
      // @ts-expect-error req.query.access_token may be null
      token = req.query.access_token
    }
    if (token != null) {
      // @ts-expect-error matrixTokens not in Collections
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
                  epoch: Utils.epoch()
                }
                // STORE
                // @ts-expect-error recoveryWords not in Collections
                db.insert('matrixTokens', {
                  // eslint-disable-next-line n/no-callback-literal
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                  // @ts-ignore token is defined
                  id: token,
                  data: JSON.stringify(data)
                }).catch((e) => {
                  /* istanbul ignore next */
                  db.logger.error('Unable to insert a token', e)
                })
                // eslint-disable-next-line n/no-callback-literal
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                // @ts-ignore token is defined
                callback(data, token)
              } else {
                db.logger.warn('Bad token', userInfo)
                Utils.send(res, 401, errMsg('unAuthorized'))
              }
            })
            .catch((e) => {
              /* istanbul ignore next */
              db.logger.debug('Fetch error', e)
              /* istanbul ignore next */
              Utils.send(res, 401, errMsg('unAuthorized'))
            })
        })
    } else {
      db.logger.warn('Access tried without token', req.headers)
      Utils.send(res, 401, errMsg('unAuthorized'))
    }
  }
}

export default Authenticate
