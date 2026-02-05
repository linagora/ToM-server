import { type AmqpConfig } from '@twake/amqp-connector'

/**
 * Defines the retry strategy for Synapse admin API operations.
 * This controls how the bridge handles failures when attempting to update
 * user profiles via the Synapse admin API.
 */
export enum SynapseAdminRetryMode {
  DISABLED = 'disabled',
  FALLBACK = 'fallback',
  EXCLUSIVE = 'exclusive'
}

/**
 * Represents user profile and settings data that can be synchronized
 * across services via the common-settings bridge.
 */
export interface ISettingsPayload {
  readonly language?: string
  readonly timezone?: string
  readonly avatar?: string
  readonly last_name?: string
  readonly first_name?: string
  readonly email?: string
  readonly phone?: string
  readonly matrix_id: string
  readonly display_name?: string
}

/**
 * Represents a complete message exchanged via AMQP for settings synchronization.
 */
export interface CommonSettingsMessage {
  readonly source: string
  readonly nickname: string
  readonly request_id: string
  readonly timestamp: number
  readonly version: number
  readonly payload: ISettingsPayload
}

/**
 * Represents user settings as stored in the bridge database.
 * Named StoredUserSettings to distinguish from the UserSettings type
 * in the @twake/common-settings package.
 */
export interface StoredUserSettings {
  readonly source?: string
  readonly nickname: string
  readonly request_id: string
  readonly timestamp: number
  readonly version: number
  readonly payload: ISettingsPayload
}

/**
 * Configuration for AMQP exchange, queue, and routing within the bridge.
 */
export interface BridgeAmqpConfig {
  readonly exchange: string
  readonly queue: string
  readonly routingKey?: string
  readonly deadLetterExchange?: string
  readonly deadLetterRoutingKey?: string
}

/**
 * Configuration for the bridge's database connection.
 */
export interface DatabaseConfig {
  readonly engine: 'sqlite' | 'pg'
  readonly host?: string
  readonly name?: string
  readonly user?: string
  readonly password?: string
  readonly ssl?: boolean
  readonly vacuumDelay?: number
}

/**
 * Configuration specific to Synapse homeserver integration.
 */
export interface SynapseConfig {
  readonly adminRetryMode: 'disabled' | 'fallback' | 'exclusive'
  /** Maximum avatar file size in bytes. Default: 5MB (5242880) */
  readonly avatarMaxSizeBytes?: number
  /** Timeout for fetching external avatar URLs in milliseconds. Default: 10000 (10s) */
  readonly avatarFetchTimeoutMs?: number
}

/**
 * Complete configuration for the common-settings bridge.
 */
export interface BridgeConfig {
  readonly homeserverUrl: string
  readonly domain: string
  readonly registrationPath: string
  readonly synapse: SynapseConfig
  readonly rabbitmq: AmqpConfig & BridgeAmqpConfig
  readonly database: DatabaseConfig
}

/**
 * Type literal for the user settings database table name.
 */
export type UserSettingsTableName = 'usersettings'

/**
 * Minimal logger interface for creating adapters.
 */
export interface AppLogger {
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

/**
 * TwakeLogger-compatible interface for @twake/db and @twake/amqp-connector.
 */
export interface TwakeLoggerAdapter {
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
  silly: (...args: unknown[]) => void
  close: () => void
}

/**
 * Creates a TwakeLogger-compatible adapter from an AppLogger with a prefix.
 * @param log - The source logger to wrap
 * @param prefix - Prefix to add to all log messages (e.g., 'DB', 'AMQP')
 * @returns A TwakeLogger-compatible object
 */
export function createLoggerAdapter(
  log: AppLogger,
  prefix: string
): TwakeLoggerAdapter {
  return {
    error: (...args: unknown[]) => log.error(`[${prefix}]`, ...args),
    warn: (...args: unknown[]) => log.warn(`[${prefix}]`, ...args),
    info: (...args: unknown[]) => log.info(`[${prefix}]`, ...args),
    debug: (...args: unknown[]) => log.debug(`[${prefix}]`, ...args),
    silly: (...args: unknown[]) => log.debug(`[${prefix}][SILLY]`, ...args),
    close: () => {}
  }
}

// =============================================================================
// Error Classes (merged from errors.ts)
// =============================================================================

/**
 * Error thrown when a user ID (matrix_id) is not provided in the message payload.
 * This occurs when processing AMQP messages that lack the required user identifier
 * needed to perform profile updates.
 */
export class UserIdNotProvidedError extends Error {
  constructor(message = 'User ID (matrix_id) not provided in message payload') {
    super(message)
    this.name = 'UserIdNotProvidedError'
  }
}

/**
 * Error thrown when parsing an AMQP message payload fails.
 * This can occur due to malformed JSON, unexpected data types,
 * or missing required fields in the message structure.
 */
export class MessageParseError extends Error {
  constructor(message = 'Failed to parse AMQP message payload') {
    super(message)
    this.name = 'MessageParseError'
  }
}

/**
 * Error thrown when an avatar download fails validation checks.
 * This includes timeout, size limit exceeded, or HTTP errors.
 */
export class AvatarFetchError extends Error {
  constructor(message = 'Failed to fetch avatar from external URL') {
    super(message)
    this.name = 'AvatarFetchError'
  }
}
