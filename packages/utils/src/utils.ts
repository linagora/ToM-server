/* istanbul ignore file */
import { type TwakeLogger } from '@twake/logger'
import { type NextFunction, type Request, type Response } from 'express'
import type http from 'http'
import { errMsg } from './errors'

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

export const jsonContent = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  logger: TwakeLogger,
  callback: (obj: Record<string, string>) => void
): void => {
  try {
    const obj = (req as Request).body

    if (!obj) {
      logger.error('No JSON body')
      throw new Error('JSON error')
    }

    callback(obj)
  } catch (error) {
    console.error({ error })
    logger.error('JSON error', error)
    send(res, 400, errMsg('unknown'))
  }
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

export const toMatrixId = (localpart: string, serverName: string): string => {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!localpart.match(/^[a-z0-9_\-.=/]+$/)) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw errMsg('invalidUsername')
  }
  return `@${localpart}:${serverName}`
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
