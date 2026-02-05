import { CommonSettingsMessage } from './types'
import type { SettingsPayload } from './types'
import { UserIdNotProvidedError, MessageParseError } from './errors'

/**
 * Represents a validated and parsed message ready for processing.
 * Contains all required fields with defaults applied.
 */
export interface ParsedMessage {
  userId: string
  version: number
  timestamp: number
  requestId: string
  source: string
  payload: SettingsPayload
}

/**
 * Attempts to parse a JSON string into a CommonSettingsMessage object.
 * Returns null if parsing fails instead of throwing an error.
 *
 * @param raw - The raw JSON string to parse
 * @returns The parsed message or null if parsing failed
 *
 * @example
 * ```typescript
 * const message = parseMessage('{"source":"app","request_id":"123",...}')
 * if (message === null) {
 *   console.error('Failed to parse message')
 * }
 * ```
 */
export function parseMessage(raw: string): CommonSettingsMessage | null {
  try {
    return JSON.parse(raw) as CommonSettingsMessage
  } catch (error) {
    return null
  }
}

/**
 * Validates a CommonSettingsMessage and extracts required fields.
 * Applies default values where appropriate (version defaults to 1).
 *
 * @param message - The message to validate
 * @returns A ParsedMessage with all required fields validated
 * @throws {MessageParseError} If message is missing request_id or timestamp
 * @throws {UserIdNotProvidedError} If message is missing matrix_id in payload
 *
 * @example
 * ```typescript
 * try {
 *   const parsed = validateMessage(message)
 *   console.log(`User: ${parsed.userId}, Version: ${parsed.version}`)
 * } catch (error) {
 *   if (error instanceof UserIdNotProvidedError) {
 *     console.error('Missing user ID')
 *   }
 * }
 * ```
 */
export function validateMessage(message: CommonSettingsMessage): ParsedMessage {
  // Validate required fields
  if (!message.request_id) {
    throw new MessageParseError('Message missing required request_id field')
  }

  if (message.timestamp === undefined || message.timestamp === null) {
    throw new MessageParseError('Message missing required timestamp field')
  }

  if (!message.payload?.matrix_id) {
    throw new UserIdNotProvidedError()
  }

  // Extract and return validated data with defaults
  return {
    userId: message.payload.matrix_id,
    version: message.version ?? 1,
    timestamp: message.timestamp,
    requestId: message.request_id,
    source: message.source,
    payload: message.payload
  }
}
