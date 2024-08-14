import { type TwakeLogger } from '@twake/logger'
import { type Request, type Response } from 'express'
import type http from 'http'
import { type tokenContent } from './account/register'
import type IdentityServerDb from './db'
import { errMsg, getAccessToken, send } from '@twake/utils'

export type AuthenticationFunction = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  callback: (data: tokenContent, id: string | null) => void,
  requiresTerms?: boolean
) => void

export const Authenticate = <T extends string = never>(
  db: IdentityServerDb<T>,
  logger: TwakeLogger
): AuthenticationFunction => {
  return (req, res, callback, requiresTerms = true) => {
    const token = getAccessToken(req)
    if (token != null) {
      db.get('accessTokens', ['data'], { id: token })
        .then((rows) => {
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (!rows || rows.length === 0) {
            logger.error(
              `${
                req.socket.remoteAddress as string
              } sent an inexistent token ${token}`
            )
            send(res, 401, errMsg('unAuthorized'))
          } else {
            if (requiresTerms) {
              db.get('userPolicies', ['policy_name', 'accepted'], {
                user_id: JSON.parse(rows[0].data as string).sub
              })
                .then((policies) => {
                  if (policies.length === 0) {
                    callback(JSON.parse(rows[0].data as string), token)
                    // If there are no policies to accept. This assumes that for each policy we add to the config, we update the database and add the corresponding policy with accepted = 0 for all users
                    return
                  }
                  const notAcceptedTerms = policies.find(
                    (row) => row.accepted === 0
                  ) // We assume the terms database contains all policies. If we update the policies we must also update the database and add the corresponding policy with accepted = 0 for all users
                  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                  if (notAcceptedTerms) {
                    logger.error(
                      `Please accept our updated terms of service before continuing.`
                    )
                    send(res, 403, errMsg('termsNotSigned'))
                  } else {
                    callback(JSON.parse(rows[0].data as string), token)
                  }
                })
                .catch((e) => {
                  logger.error(
                    `Please accept our updated terms of service before continuing.`,
                    e
                  )
                  send(res, 403, errMsg('termsNotSigned'))
                })
            } else {
              callback(JSON.parse(rows[0].data as string), token)
            }
          }
        })
        .catch((e) => {
          logger.error(
            `${req.socket.remoteAddress as string} sent an invalid token`,
            e
          )
          send(res, 401, errMsg('unAuthorized'))
        })
    } else {
      logger.error(
        `${req.socket.remoteAddress as string} tried to access without token`
      )
      send(res, 401, errMsg('unAuthorized'))
    }
  }
}
