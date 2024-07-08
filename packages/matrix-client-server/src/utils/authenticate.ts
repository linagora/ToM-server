import { type TwakeLogger } from '@twake/logger'
import { type Request, type Response } from 'express'
import type http from 'http'
import type MatrixDBmodified from '../matrixDb'
import { epoch, errMsg, send } from '@twake/utils'

export interface tokenContent {
  sub: string
  device_id?: string
  epoch: number
}

export type AuthenticationFunction = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  callback: (data: tokenContent, id: string | null) => void
) => void

const Authenticate = (
  matrixDb: MatrixDBmodified,
  logger: TwakeLogger
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
      // @ts-expect-error req.query.access_token may be null
      token = req.query.access_token
    }
    if (token != null) {
      let data: tokenContent
      matrixDb
        .get('user_ips', ['user_id, device_id'], { access_token: token })
        .then((rows) => {
          if (rows.length === 0) {
            throw Error()
          }
          data = { sub: rows[0].user_id as string, epoch: epoch() }
          data.sub = rows[0].user_id as string
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (rows[0].device_id) {
            data.device_id = rows[0].device_id as string
          }
          callback(data, token)
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
