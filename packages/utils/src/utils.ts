/* istanbul ignore file */
import { type TwakeLogger } from '@twake/logger'
import { type NextFunction, type Request, type Response } from 'express'
import type http from 'http'
import querystring from 'querystring'
import { errMsg } from './errors'

export type expressAppHandler = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  next?: NextFunction
) => void

export const send = (
  res: Response | http.ServerResponse,
  status: number,
  body: string | object,
  logger?: TwakeLogger
): void => {
  /* istanbul ignore next */
  const content = typeof body === 'string' ? body : JSON.stringify(body)
  if (logger != null) {
    const logMessage = `Sending status ${status} with content ${content}`
    if (status >= 200 && status < 300) {
      logger.debug(logMessage)
    } else {
      logger.error(logMessage)
    }
  }
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
    send(res, 400, errMsg('unknown', err.toString()))
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
  callback: (obj: object) => void,
  acceptAdditionalParameters?: boolean
) => void

const _validateParameters: validateParametersType = (
  res,
  desc,
  content,
  logger,
  callback,
  acceptAdditionalParameters
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
      if (acceptAdditionalParameters === false) {
        logger.error('Additional parameters', additionalParameters)
        send(
          res,
          400,
          errMsg(
            'unknownParam',
            `Unknown additional parameters ${additionalParameters.join(', ')}`
          )
        )
      } else {
        logger.warn('Additional parameters', additionalParameters)
        callback(content)
      }
    } else {
      callback(content)
    }
  }
}

export const validateParameters: validateParametersType = (
  res,
  desc,
  content,
  logger,
  callback
) => {
  _validateParameters(res, desc, content, logger, callback, true)
}

export const validateParametersStrict: validateParametersType = (
  res,
  desc,
  content,
  logger,
  callback
) => {
  _validateParameters(res, desc, content, logger, callback, false)
}

export const epoch = (): number => {
  return Date.now()
}

export const toMatrixId = (localpart: string, serverName: string): string => {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!localpart.match(/^[a-z0-9_\-./=+]+$/)) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw errMsg('invalidUsername')
  }
  const userId = `@${localpart}:${serverName}`
  if (userId.length > 255) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw errMsg('invalidUsername')
  }
  return userId
}

export const isValidUrl = (link: string): boolean => {
  try {
    // eslint-disable-next-line no-new
    new URL(link)
    return true
  } catch {
    return false
  }
}

export const getAccessToken = (
  req: Request | http.IncomingMessage
): string | null => {
  const tokenRe = /^Bearer (\S+)$/
  let token: string | null = null
  if (req.headers.authorization != null) {
    const re = req.headers.authorization.match(tokenRe)
    if (re != null) {
      token = re[1]
    }
    // @ts-expect-error req.query exists
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  } else if (req.query && Object.keys(req.query).length > 0) {
    // @ts-expect-error req.query.access_token may be null
    token = req.query.access_token
  }
  return token
}
