import { type NextFunction, type Request, type Response } from 'express'
import { type VaultDbBackend } from '../db/utils'
import { type tokenContent } from '@twake/matrix-identity-server'
import { VaultAPIError, type expressAppHandler } from '../utils'

export interface tokenDetail {
  value: string
  content: tokenContent
}

const tokenRe = /^Bearer ([a-zA-Z0-9]{64})$/
const unauthorizedError = new VaultAPIError('Not Authorized', 401)

const isAuth = (db: VaultDbBackend): expressAppHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    let token: string | null = null
    if (req.headers?.authorization != null) {
      const re = req.headers.authorization.match(tokenRe)
      if (re != null) {
        token = re[1]
      }
    } else if (req.query != null) {
      // @ts-expect-error req.query.access_token may be null
      token = req.query.access_token
    }
    if (token != null) {
      db.get('accessTokens', ['data'], 'id', token)
        .then((rows) => {
          if (rows.length === 0) {
            throw unauthorizedError
          }
          req.token = {
            content: JSON.parse(rows[0].data as string),
            // @ts-expect-error token is defined
            value: token
          }
          next()
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
