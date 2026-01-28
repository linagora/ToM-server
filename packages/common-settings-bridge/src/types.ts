/**
 * Types for common-settings-bridge
 */

/**
 * RabbitMQ message payload for user profile updates
 */
export interface SettingsPayload {
  matrix_id: string
  display_name?: string
  avatar?: string
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  language?: string
  timezone?: string
}

/**
 * Full RabbitMQ message structure
 */
export interface CommonSettingsMessage {
  source: string
  nickname: string
  request_id: string
  timestamp: number
  version: number
  payload: SettingsPayload
}

/**
 * User settings stored in database
 */
export interface UserSettings {
  matrix_id: string
  settings: SettingsPayload
  version: number
}

/**
 * Payload for updating user profile via Synapse
 */
export interface UserProfileUpdate {
  displayName?: string
  avatarUrl?: string
}

/**
 * RabbitMQ configuration
 */
export interface RabbitMQConfig {
  host: string
  port: number
  username: string
  password: string
  vhost: string
  tls: boolean
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  name: string
  exchange: string
  routingKey?: string
  deadLetterExchange?: string
  deadLetterRoutingKey?: string
}

/**
 * Synapse/Bridge configuration
 */
export interface SynapseConfig {
  homeserverUrl: string
  domain: string
  registrationPath: string
  /**
   * Mode for using Synapse Admin API for profile updates:
   * - 'disabled': Only use standard AS masquerading (default)
   * - 'fallback': Try standard first, use Admin API if it fails
   * - 'exclusive': Only use Admin API
   */
  adminApiMode?: 'disabled' | 'fallback' | 'exclusive'
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  engine: 'sqlite' | 'pg'
  host: string
  name?: string
  user?: string
  password?: string
  ssl?: boolean
}

/**
 * Complete service configuration
 */
export interface BridgeConfig {
  rabbitmq: RabbitMQConfig
  queue: QueueConfig
  synapse: SynapseConfig
  database: DatabaseConfig
  logLevel?: string
}

/**
 * Database table collections for common-settings-bridge
 */
export type BridgeCollections = 'usersettings'

/**
 * Result from database get operations
 */
export interface DbGetResult {
  rows: UserSettings[]
  rowCount: number
}
