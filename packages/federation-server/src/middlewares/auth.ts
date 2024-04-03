import { type TwakeLogger } from '@twake/logger'
import {
  MatrixErrors,
  Utils,
  type tokenContent
} from '@twake/matrix-identity-server'
import { type NextFunction, type Response } from 'express'
import { type AuthRequest, type IdentityServerDb } from '../types'
import { convertToIPv6 } from '../utils/ip-address'

const tokenTrustedServer = 'TOKEN_TRUSTED_SERVER'

export const Authenticate = (
  db: IdentityServerDb,
  trustedServersList: string[],
  trustXForwardedForHeader: boolean,
  logger: TwakeLogger
): Utils.AuthenticationFunction => {
  const trustedServersListAsIPv6 = trustedServersList.map((ip) =>
    convertToIPv6(ip)
  )
  const tokenRe = /^Bearer (\S+)$/
  return (req, res, callbackMethod) => {
    const request = req as AuthRequest
    const originalRequesterIPAddress = trustXForwardedForHeader
      ? // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        (request.headers['x-forwarded-for'] as string) ||
        (request.socket.remoteAddress as string)
      : (request.socket.remoteAddress as string)
    logger.info('', {
      ip: originalRequesterIPAddress,
      httpMethod: request.method,
      endpointPath: request.originalUrl
    })
    try {
      const requesterIPAddress = convertToIPv6(originalRequesterIPAddress)
      logger.debug(`Authenticated request from ${originalRequesterIPAddress}`)
      // istanbul ignore if
      if (trustedServersListAsIPv6.includes(requesterIPAddress)) {
        logger.debug('IP is in list')
        callbackMethod({ sub: '', epoch: 0 }, tokenTrustedServer)
      } else if (
        trustedServersListAsIPv6.some((ip) => {
          const res = requesterIPAddress.isInSubnet(ip)
          if (res) logger.debug(`IP is in ${ip.address}`)
          return res
        })
      ) {
        callbackMethod({ sub: '', epoch: 0 }, tokenTrustedServer)
      } else {
        logger.debug(`${originalRequesterIPAddress} isn't in white list`)
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
              callbackMethod(JSON.parse(rows[0].data as string), token)
            })
            .catch((e) => {
              Utils.send(res, 401, MatrixErrors.errMsg('unAuthorized'))
            })
        } else {
          Utils.send(res, 401, MatrixErrors.errMsg('unAuthorized'))
        }
      }
    } catch (error) {
      logger.debug(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Real error: ${error instanceof Error ? error.message : error}`
      )
      logger.error(`Unauthorized`, {
        ip: originalRequesterIPAddress,
        httpMethod: request.method,
        endpointPath: request.originalUrl
      })
      Utils.send(res, 401, MatrixErrors.errMsg('unAuthorized'))
    }
  }
}

export const auth = (authenticator: Utils.AuthenticationFunction) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    authenticator(req, res, (data: tokenContent, token: string | null) => {
      if (token === tokenTrustedServer) {
        next()
        return
      }
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
}
