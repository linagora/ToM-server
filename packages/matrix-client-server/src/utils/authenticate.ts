/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { type TwakeLogger } from '@twake/logger'
import { type Request, type Response } from 'express'
import type http from 'http'
import type MatrixDBmodified from '../matrixDb'
import { epoch, errMsg, send, toMatrixId } from '@twake/utils'
import { type AppServiceRegistration, type Config } from '../types'

export interface TokenContent {
  sub: string
  device_id?: string
  epoch: number
}

export type AuthenticationFunction = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  callback: (data: TokenContent, id: string | null) => void
) => void

const Authenticate = (
  matrixDb: MatrixDBmodified,
  logger: TwakeLogger,
  conf: Config
): AuthenticationFunction => {
  const tokenRe = /^Bearer (\S+)$/
  return (req, res, callback) => {
    let token: string | null = null
    if (req.headers.authorization != null) {
      const re = req.headers.authorization.match(tokenRe)
      if (re != null) {
        token = re[1]
      }
      // @ts-expect-error req.query exists
    } else if (req.query && Object.keys(req.query).length > 0) {
      // @ts-expect-error req.query exists,  istanbul ignore next
      token = req.query.access_token
    }
    if (token != null) {
      let data: TokenContent
      matrixDb
        .get('user_ips', ['user_id, device_id'], { access_token: token })
        .then((rows) => {
          if (rows.length === 0) {
            const applicationServices = conf.application_services
            const asTokens: string[] = applicationServices.map(
              (as: AppServiceRegistration) => as.as_token
            )
            if (asTokens.includes(token as string)) {
              // Check if the request is made by an application-service
              const appService = applicationServices.find(
                (as: AppServiceRegistration) => as.as_token === token
              )
              // @ts-expect-error req.query exists
              const userId = req.query.user_id
                ? // @ts-expect-error req.query exists
                  req.query.user_id
                : //  @ts-expect-error appService exists since we found a matching token
                  toMatrixId(appService.sender_localpart, conf.server_name)
              if (
                appService?.namespaces.users &&
                !appService?.namespaces.users.some((namespace) =>
                  new RegExp(namespace.regex).test(userId)
                ) // check if the userId is registered by the appservice
              ) {
                send(
                  res,
                  403,
                  errMsg(
                    'forbidden',
                    'The appservice cannot masquerade as the user or has not registered them.'
                  )
                )
                return
              }
              // Should we check if the userId is already registered in the database?
              data = { sub: userId, epoch: epoch() }
              callback(data, token)
            } else {
              throw new Error()
            }
          } else {
            data = { sub: rows[0].user_id as string, epoch: epoch() }
            data.sub = rows[0].user_id as string
            if (rows[0].device_id) {
              data.device_id = rows[0].device_id as string
            }
            callback(data, token)
          }
        })
        .catch((e) => {
          logger.warn('Access tried with an unkown token', req.headers)
          send(res, 401, errMsg('unknownToken'))
        })
    } else {
      logger.warn('Access tried without token', req.headers)
      send(res, 401, errMsg('missingToken'))
    }
  }
}

export default Authenticate
