import { type TwakeLogger } from '@twake/logger'
import {
  MatrixErrors,
  Utils,
  type tokenContent
} from '@twake/matrix-identity-server'
import { type NextFunction, type RequestHandler, type Response } from 'express'
import { type AuthRequest, type IdentityServerDb } from '../types'
import { convertToIPv6 } from '../utils/ip-address'
import { FederationServerError } from './errors'

export const Authenticate = (
  db: IdentityServerDb
): Utils.AuthenticationFunction => {
  const tokenRe = /^Bearer (\S+)$/
  return (req, res, callback) => {
    let token: string | null = null
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
      db.get('accessTokens', ['data'], { id: token })
        .then((rows) => {
          callback(JSON.parse(rows[0].data as string), token)
        })
        .catch((e) => {
          Utils.send(res, 401, MatrixErrors.errMsg('unAuthorized'))
        })
    } else {
      throw new FederationServerError({
        status: 401,
        code: MatrixErrors.errCodes.unAuthorized
      })
    }
  }
}

export const auth = (
  authenticator: Utils.AuthenticationFunction,
  trustedServersList: string[],
  logger: TwakeLogger
): RequestHandler => {
  const trustedServersListAsIPv6 = trustedServersList.map((ip) =>
    convertToIPv6(ip)
  )
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const date = new Date()
    const originalRequesterIPAddress =
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      (req.headers['x-forwarded-for'] as string) ||
      (req.socket.remoteAddress as string)
    logger.info(
      `${date.toUTCString()} Received ${req.method} to ${
        req.originalUrl
      } from ${originalRequesterIPAddress}`
    )
    try {
      const requesterIPAddress = convertToIPv6(originalRequesterIPAddress)
      if (
        trustedServersListAsIPv6.includes(requesterIPAddress) ||
        trustedServersListAsIPv6.some((ip) => requesterIPAddress.isInSubnet(ip))
      ) {
        next()
      } else {
        authenticator(req, res, (data: tokenContent, token: string | null) => {
          /* istanbul ignore if */
          if (data.sub === undefined) {
            throw new Error('Invalid data')
          }

          req.userId = data.sub
          if (token != null) {
            req.accessToken = token
          }
          next()
        })
      }
    } catch (error) {
      logger.error(
        `${date.toUTCString()} Unauthorized ${req.method} to ${
          req.originalUrl
        } from ${originalRequesterIPAddress}`
      )
      throw new FederationServerError({
        status: 401,
        code: MatrixErrors.errCodes.unAuthorized
      })
    }
  }
}
