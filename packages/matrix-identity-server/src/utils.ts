import { type TwakeLogger } from '@twake/logger'
import { type NextFunction, type Request, type Response } from 'express'
import type http from 'http'
import querystring from 'querystring'
import { type tokenContent } from './account/register'
import type IdentityServerDb from './db'
import { errMsg } from './utils/errors'

export const hostnameRe =
  /^((([a-zA-Z0-9][-a-zA-Z0-9]*)?[a-zA-Z0-9])[.])*([a-zA-Z][-a-zA-Z0-9]*[a-zA-Z0-9]|[a-zA-Z])(:(\d+))?$/

export type expressAppHandler = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  next?: NextFunction
) => void

export const send = (
  res: Response | http.ServerResponse,
  status: number,
  body: string | object
): void => {
  /* istanbul ignore next */
  const content = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(content, 'utf-8'),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  })
  res.write(content)
  res.end()
}

export type AuthenticationFunction = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  callback: (data: tokenContent, id: string | null) => void,
  requiresTerms?: boolean
) => void

export const Authenticate = (
  db: IdentityServerDb,
  logger: TwakeLogger
): AuthenticationFunction => {
  const tokenRe = /^Bearer (\S+)$/
  return (req, res, callback, requiresTerms = true) => {
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
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (!rows || rows.length === 0) {
            logger.error(
              `${req.socket.remoteAddress as string} sent an inexistent token ${
                token as string
              }`
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

export const jsonContent = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  logger: TwakeLogger,
  callback: (obj: Record<string, string>) => void
): void => {
  let content = ''
  let accept = true
  req.on('data', (body: string) => {
    content += body
  })
  /* istanbul ignore next */
  req.on('error', (err) => {
    send(res, 400, errMsg('unknown', err.message))
    accept = false
  })
  req.on('end', () => {
    let obj
    try {
      // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
      if (
        req.headers['content-type']?.match(
          /^application\/x-www-form-urlencoded/
        ) != null
      ) {
        obj = querystring.parse(content)
      } else {
        obj = JSON.parse(content)
      }
    } catch (err) {
      logger.error('JSON error', err)
      logger.error(`Content was: ${content}`)
      send(res, 400, errMsg('unknown', err as string))
      accept = false
    }
    if (accept) callback(obj)
  })
}

type validateParametersSchema = Record<string, boolean>

type validateParametersType = (
  res: Response | http.ServerResponse,
  desc: validateParametersSchema,
  content: Record<string, string>,
  logger: TwakeLogger,
  callback: (obj: object) => void
) => void

export const validateParameters: validateParametersType = (
  res,
  desc,
  content,
  logger,
  callback
) => {
  const missingParameters: string[] = []
  const additionalParameters: string[] = []
  // Check for required parameters
  Object.keys(desc).forEach((key) => {
    if (desc[key] && content[key] == null) {
      missingParameters.push(key)
    }
  })
  if (missingParameters.length > 0) {
    send(
      res,
      400,
      errMsg(
        'missingParams',
        `Missing parameters ${missingParameters.join(', ')}`
      )
    )
  } else {
    Object.keys(content).forEach((key) => {
      if (desc[key] == null) {
        additionalParameters.push(key)
      }
    })
    if (additionalParameters.length > 0) {
      logger.warn('Additional parameters', additionalParameters)
    }
    callback(content)
  }
}

export const epoch = (): number => {
  return Date.now()
}
