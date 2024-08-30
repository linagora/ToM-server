/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { type TwakeLogger } from '@twake/logger'
import { type Request, type Response } from 'express'
import type http from 'http'
import type MatrixDBmodified from '../matrixDb'
import { epoch, errMsg, getAccessToken, send, toMatrixId } from '@twake/utils'
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

// TODO : Check for guest access. As is, there is nothing that prevents a guest from accessing the endpoints he is not supposed to access
// Since register assigns him an access token. Maybe it should assign him a guest token that is differentiated in authenticate
// To only allow him access to the endpoints he is supposed to access
// Check this for more information : https://spec.matrix.org/v1.11/client-server-api/#guest-access
const Authenticate = (
  matrixDb: MatrixDBmodified,
  logger: TwakeLogger,
  conf: Config
): AuthenticationFunction => {
  return (req, res, callback) => {
    const token = getAccessToken(req)
    if (token != null) {
      let data: TokenContent
      matrixDb
        .get(
          'access_tokens',
          ['user_id, device_id', 'refresh_token_id', 'used'],
          {
            token
          }
        )
        .then((rows) => {
          if (rows.length === 0) {
            const applicationServices = conf.application_services
            const asTokens: string[] = applicationServices.map(
              (as: AppServiceRegistration) => as.as_token
            )
            if (asTokens.includes(token)) {
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
                  ),
                  logger
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
            if (rows[0].used === 1) {
              logger.error('Access tried with an invalid token', req.headers)
              send(
                res,
                401,
                errMsg('invalidToken', 'Access token has been refreshed')
              )
              return
            }
            data = { sub: rows[0].user_id as string, epoch: epoch() }
            data.sub = rows[0].user_id as string
            if (rows[0].device_id) {
              data.device_id = rows[0].device_id as string
            }
            matrixDb
              .deleteWhere('refresh_tokens', {
                // Invalidate the old refresh token and access token (condition ON DELETE CASCADE) once the new access token is used
                field: 'next_token_id',
                value: rows[0].refresh_token_id as number,
                operator: '='
              })
              .then(() => {
                callback(data, token)
              })
              .catch((e) => {
                // istanbul ignore next
                logger.error('Error deleting the old refresh token', e)
                // istanbul ignore next
                send(res, 500, errMsg('unknown', e.toString()))
              })
          }
        })
        .catch((e) => {
          logger.warn('Access tried with an unkown token', req.headers)
          send(res, 401, errMsg('unknownToken'), logger)
        })
    } else {
      logger.warn('Access tried without token', req.headers)
      send(res, 401, errMsg('missingToken'), logger)
    }
  }
}

export default Authenticate
