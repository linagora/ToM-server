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

/**
 * Maximum length for a complete Matrix user ID including @ sigil and domain.
 * Per Matrix spec: "The length of a user ID, including the @ sigil and the domain, MUST NOT exceed 255 characters."
 * @see https://spec.matrix.org/v1.1/appendices/#user-identifiers
 */
const MAX_MATRIX_ID_LENGTH = 255

/**
 * Regex for validating Matrix user ID localpart.
 * Per Matrix spec grammar: user_id_char = DIGIT / %x61-7A / "-" / "." / "=" / "_" / "/"
 * Allows: digits (0-9), lowercase letters (a-z), and symbols: - . = _ /
 * Note: The spec also defines historical compatibility with expanded character set.
 * @see https://spec.matrix.org/v1.1/appendices/#user-identifiers
 */
const VALID_LOCALPART_REGEX = /^[a-z0-9_\-.=/+]+$/

/**
 * Regex for validating IPv4 addresses with proper range checking.
 * Ensures each octet is 0-255 (not just any 1-3 digits).
 */
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

/**
 * Regex for validating IPv6 addresses in brackets.
 * Supports standard IPv6 notation including :: compression.
 */
const IPV6_REGEX =
  /^\[(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|::(?:ffff(?::0{1,4})?:)?(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9]))\]$/

/**
 * Regex for validating DNS names.
 * - Must not contain consecutive dots (..)
 * - Can contain letters, digits, hyphens, and dots
 * - Must not start or end with hyphen
 * - Each label must be 1-63 characters
 * - Total length handled separately (max 253 for DNS, but server name can be longer with port)
 */
const DNS_NAME_REGEX =
  /^(?!.*\.\.)(?!.*-$)(?!^-)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

/**
 * Regex for validating port numbers (1-65535).
 * Ensures port is within valid range, not just any 1-5 digits.
 */
const PORT_REGEX =
  /^:(?:6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3})$/

/**
 * Validates a Matrix server name component.
 * Server names can be: DNS names, IPv4 addresses, or IPv6 addresses (in brackets),
 * optionally followed by a port number.
 *
 * @param serverName - The server name to validate
 * @returns True if valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidServerName('matrix.org')        // true
 * isValidServerName('matrix.org:8448')   // true
 * isValidServerName('192.168.1.1')       // true
 * isValidServerName('[::1]:8008')        // true
 * isValidServerName('invalid..name')     // false
 * ```
 */
const isValidServerName = (serverName: string): boolean => {
  if (!serverName || serverName.length === 0) {
    return false
  }

  let hostname: string
  let portPart = ''

  if (serverName.startsWith('[')) {
    const bracketEnd = serverName.indexOf(']')
    if (bracketEnd === -1) {
      return false
    }
    hostname = serverName.substring(0, bracketEnd + 1)
    portPart = serverName.substring(bracketEnd + 1)

    if (!IPV6_REGEX.test(hostname)) {
      return false
    }
  } else {
    const lastColonIndex = serverName.lastIndexOf(':')
    if (lastColonIndex > 0) {
      hostname = serverName.substring(0, lastColonIndex)
      portPart = serverName.substring(lastColonIndex)
    } else {
      hostname = serverName
    }

    const looksLikeIPv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)

    if (looksLikeIPv4) {
      if (!IPV4_REGEX.test(hostname)) {
        return false
      }
    } else {
      if (!DNS_NAME_REGEX.test(hostname)) {
        return false
      }
    }
  }

  if (portPart.length > 0) {
    if (!PORT_REGEX.test(portPart)) {
      return false
    }
  }

  return true
}

/**
 * Converts a localpart and server name into a Matrix ID.
 *
 * @param localpart - The local part of the Matrix ID (e.g., "user").
 * @param serverName - The server name for the Matrix ID (e.g., "matrix.org" or "192.168.1.1:8080").
 * @returns The full Matrix ID string (e.g., "@user:matrix.org").
 *
 * @throws {TypeError} If `localpart` or `serverName` are not strings, are empty,
 * or if they contain invalid characters/format according to Matrix specification.
 * @throws {Error} If the resulting Matrix ID exceeds 255 characters (Matrix spec limit).
 *
 * @example
 * ```typescript
 * toMatrixId('alice', 'matrix.org')           // '@alice:matrix.org'
 * toMatrixId('bob', 'example.com:8448')       // '@bob:example.com:8448'
 * toMatrixId('user', '[::1]')                 // '@user:[::1]'
 * toMatrixId('Invalid User', 'matrix.org')    // throws Error (invalid localpart)
 * ```
 *
 * @see https://spec.matrix.org/latest/appendices/#user-identifiers
 */
export const toMatrixId = (localpart: string, serverName: string): string => {
  if (typeof localpart !== 'string' || localpart.length === 0) {
    throw new TypeError('localpart must be a non-empty string')
  }

  if (typeof serverName !== 'string' || serverName.length === 0) {
    throw new TypeError('serverName must be a non-empty string')
  }

  if (!VALID_LOCALPART_REGEX.test(localpart)) {
    throw errMsg('invalidUsername')
  }

  if (!isValidServerName(serverName)) {
    throw new TypeError(
      'serverName contains invalid characters or format according to Matrix specification.'
    )
  }

  const matrixId = `@${localpart}:${serverName}`

  if (matrixId.length > MAX_MATRIX_ID_LENGTH) {
    throw new TypeError(
      `Matrix ID exceeds maximum length of ${MAX_MATRIX_ID_LENGTH} characters (got ${matrixId.length})`
    )
  }

  return matrixId
}

/**
 * Validates if a given string is a valid Matrix user ID.
 *
 * Checks that the string:
 * - Starts with '@' sigil
 * - Has valid localpart (lowercase letters, digits, and allowed symbols)
 * - Has valid server name (DNS name, IPv4, or IPv6 with optional port)
 * - Does not exceed 255 characters total length
 *
 * @param id - The string to validate as a Matrix ID.
 * @returns True if the string is a valid Matrix ID, false otherwise.
 *
 * @example
 * ```typescript
 * isMatrixId('@alice:matrix.org')                 // true
 * isMatrixId('@bob:example.com:8448')             // true
 * isMatrixId('@user:192.168.1.1')                 // true
 * isMatrixId('@test:[2001:db8::1]:8008')          // true
 * isMatrixId('alice:matrix.org')                  // false (missing @)
 * isMatrixId('@Invalid User:matrix.org')          // false (invalid localpart)
 * isMatrixId('@user')                             // false (missing server)
 * ```
 *
 * @see https://spec.matrix.org/latest/appendices/#user-identifiers
 */
export const isMatrixId = (id: string): boolean => {
  if (typeof id !== 'string' || !id.startsWith('@')) {
    return false
  }

  if (id.length > MAX_MATRIX_ID_LENGTH) {
    return false
  }

  const firstColonIndex = id.indexOf(':', 1)
  if (firstColonIndex === -1) {
    return false
  }

  const localpart = id.substring(1, firstColonIndex)
  const serverName = id.substring(firstColonIndex + 1)

  if (localpart.length === 0 || serverName.length === 0) {
    return false
  }

  if (!VALID_LOCALPART_REGEX.test(localpart)) {
    return false
  }

  return isValidServerName(serverName)
}

/**
 * Checks if a given string is a valid URL.
 *
 * @param link - The string to validate as a URL.
 * @returns True if the string is a valid URL, false otherwise.
 */

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
  if (!id || !id.startsWith('@')) return null
  const parts = id.split(':')
  if (parts.length < 2) return null
  return parts[0].slice(1)
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
