import type IdentityServerDb from '@twake/matrix-identity-server/dist/db'
import { type AuthenticationFunction } from '@twake/matrix-identity-server/dist/utils'
import { Utils, errMsg, type tokenContent } from '@twake/matrix-identity-server'
import { type Config } from '..'
import fetch from 'node-fetch'

interface WhoAmIResponse {
  user_id?: string
  is_guest?: string
  device_id?: string
}

const Authenticate = (
  db: IdentityServerDb,
  conf: Config
): AuthenticationFunction => {
  const tokenRe = /^Bearer ([a-zA-Z0-9]{64})$/
  return (req, res, callback) => {
    let token: string | null = ''
    if (req.headers.authorization != null) {
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
      db.get('accessTokens', ['data'], 'id', token)
        .then((rows) => {
          // @ts-expect-error token is defined
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
              if (uid != null) {
                const data: tokenContent = {
                  sub: uid,
                  epoch: Utils.epoch()
                }
                // STORE
                db.insert('accessTokens', {
                  // eslint-disable-next-line n/no-callback-literal
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                  // @ts-ignore token is defined
                  id: token,
                  data: JSON.stringify(data)
                }).catch((e) => {
                  console.error('Unable to insert a token', e)
                })
                // eslint-disable-next-line n/no-callback-literal
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                // @ts-ignore token is defined
                callback(data, token)
              } else {
                Utils.send(res, 401, errMsg('unAuthorized'))
              }
            })
            .catch((e) => {
              Utils.send(res, 401, errMsg('unAuthorized'))
            })
        })
    } else {
      Utils.send(res, 401, errMsg('unAuthorized'))
    }
  }
}

export default Authenticate
