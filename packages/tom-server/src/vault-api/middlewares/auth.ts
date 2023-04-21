import { type NextFunction, type Request, type Response } from 'express'
import { VaultAPIError, type expressAppHandler } from '../utils'
import fetch from 'node-fetch'
import { type Config } from '../../utils'
import { Utils, type tokenContent } from '@twake/matrix-identity-server'
import { type WhoAmIResponse } from '../../identity-server'
import { type TwakeDB } from '../../db'
export interface tokenDetail {
  value: string
  content: tokenContent
}

const tokenRe = /^Bearer (\S+)$/
const unauthorizedError = new VaultAPIError('Not Authorized', 401)

const isAuth = (db: TwakeDB, conf: Config): expressAppHandler => {
  let tokenData: tokenContent
  return (req: Request, res: Response, next: NextFunction): void => {
    let token: string = ''
    if (req.headers?.authorization != null) {
      const re = req.headers.authorization.match(tokenRe)
      if (re != null) {
        token = re[1]
      }
    } else if (req.query != null) {
      // @ts-expect-error req.query.access_token may be null
      token = req.query.access_token
    }
    if (token != null && token.length > 0) {
      db.get('accessTokens', ['data'], 'id', token)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((rows) => {
          if (rows.length === 0) {
            return (
              fetch(
                `https://${conf.matrix_server}/_matrix/client/r0/account/whoami`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                }
              ) // eslint-disable-next-line @typescript-eslint/promise-function-async
                .then((res) => res.json())
                // eslint-disable-next-line @typescript-eslint/promise-function-async
                .then((userInfo) => {
                  const uid = (userInfo as WhoAmIResponse).user_id
                  if (uid != null) {
                    tokenData = {
                      sub: uid,
                      epoch: Utils.epoch()
                    }
                    return db.insert('accessTokens', {
                      id: token,
                      data: JSON.stringify(tokenData)
                    })
                  } else {
                    throw unauthorizedError
                  }
                })
                .then((result) => {
                  req.token = {
                    content: tokenData,
                    value: token
                  }
                  next()
                })
            )
          } else {
            req.token = {
              content: JSON.parse(rows[0].data as string),
              value: token
            }
            next()
          }
        })
        .catch((err) => {
          next(err)
        })
    } else {
      throw unauthorizedError
    }
  }
}

export default isAuth
