/* istanbul ignore file */
import { type TwakeLogger } from '@twake/logger'
import { type NextFunction, type Request, type Response } from 'express'
import type http from 'http'
import querystring from 'querystring'
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
  let content = ''
  let accept = true
  const end = (): void => {
    let obj
    try {
      if (typeof content === 'string') {
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
      } else {
        obj = content
      }
    } catch (err) {
      logger.error('JSON error', err)
      logger.error(`Content was: ${content}`)
      send(res, 400, errMsg('unknown', err as string))
      accept = false
    }
    if (accept) callback(obj)
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
  /* istanbul ignore if */ // @ts-ignore
  if (req.body) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore
    content = req.body
    end()
  }
  req.on('data', (body: string) => {
    content += body
  })
  /* istanbul ignore next */
  req.on('error', (err) => {
    send(res, 400, errMsg('unknown', err.message))
    accept = false
  })
  req.on('end', end)
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
      /* istanbul ignore if */
      if (desc[key] == null) {
        additionalParameters.push(key)
      }
    })
    /* istanbul ignore if */
    if (additionalParameters.length > 0) {
      logger.warn('Additional parameters', additionalParameters)
    }
    callback(content)
  }
}

export const epoch = (): number => {
  return Date.now()
}

// Define a global constant for the localpart validation regex
// This regex allows one or more characters from the set: lowercase letters (a-z), digits (0-9),
// and the symbols _, -, ., =, /, +. This aligns with the 'user_id_char' grammar.
// (See: https://spec.matrix.org/v1.15/appendices/#user-identifiers)
const VALID_LOCALPART_REGEX = /^[a-z0-9_\-.=/+]+$/

// Define a global constant for the server name validation regex
// This regex covers three types of hostnames (IPv4, IPv6, DNS name) optionally followed by a port.
// - IPv4address: (?:(?:\d{1,3}\.){3}\d{1,3}) - Four octets (1-3 digits) separated by dots.
// - IPv6address: \[[\da-fA-F:.]{2,45}\] - Enclosed in square brackets, 2 to 45 characters
//   which can be digits, A-F/a-f, colon, or dot.
// - dns-name: [\da-zA-Z-.]{1,255} - 1 to 255 characters which can be digits, letters, hyphen, or dot.
// - Port: (?:(?::\d{1,5}))? - Optional colon followed by 1 to 5 digits.
// (See "Server Name Grammar" note below for detailed rules and https://spec.matrix.org/v1.15/appendices/#server-name)
const VALID_SERVER_NAME_REGEX =
  /^(?:(?:\d{1,3}\.){3}\d{1,3}|\[[\da-fA-F:.]{2,45}\]|(?:(?!.*\.\.)[\da-zA-Z-.]{1,255}))(?:(?::\d{1,5}))?$/

/**
 * Converts a localpart and server name into a Matrix ID.
 *
 * @param localpart - The local part of the Matrix ID (e.g., "user").
 * @param serverName - The server name for the Matrix ID (e.g., "matrix.org" or "192.168.1.1:8080").
 * @returns The full Matrix ID string (e.g., "@user:matrix.org").
 * @throws {TypeError} If `localpart` or `serverName` are not strings, are empty,
 * or if they contain invalid characters/format according to their respective Matrix grammars.
 */
export const toMatrixId = (localpart: string, serverName: string): string => {
  if (typeof localpart !== 'string' || localpart.length === 0) {
    throw new TypeError('[_toMatrixId] localpart must be a non-empty string')
  }

  if (typeof serverName !== 'string' || serverName.length === 0) {
    throw new TypeError('[_toMatrixId] serverName must be a non-empty string')
  }

  if (!VALID_LOCALPART_REGEX.test(localpart)) {
    throw errMsg('invalidUsername')
  }

  if (!VALID_SERVER_NAME_REGEX.test(serverName)) {
    throw new TypeError(
      '[_toMatrixId] serverName contains invalid characters or format according to Matrix specification.'
    )
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

/**
 * 
 * @param id - Matrix ID
 * @returns The local part of the Matrix ID, or null if the ID is not valid or does not start with '@'.
 */
export const getLocalPart = (id: string): string | null => {
  if (!id.startsWith('@')) return null
  const parts = id.split(':')
  if (parts.length < 2) return null
  return parts[0].slice(1)
}