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
export interface SettingsPayload {
  readonly language?: string
  readonly timezone?: string
  readonly avatar?: string
  readonly last_name?: string
  readonly first_name?: string
  readonly email?: string
  readonly phone?: string
  readonly matrix_id?: string
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
  readonly payload: SettingsPayload
}

/**
 * Represents user settings as stored in the bridge database.
 */
export interface UserSettings {
  readonly matrix_id: string
  readonly settings: SettingsPayload
  readonly version: number
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
}

/**
 * Configuration specific to Synapse homeserver integration.
 */
export interface SynapseConfig {
  readonly adminRetryMode: 'disabled' | 'fallback' | 'exclusive'
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
