import { type Channel, type ConsumeMessage } from 'amqplib'

/**
 * AMQP configuration interface
 * @property host - AMQP server host
 * @property port - AMQP server port
 * @property vhost - AMQP virtual host
 * @property username - AMQP username
 * @property password - AMQP password
 * @property tls - Use TLS for the connection (default: false)
 * @returns void
 */
export interface AmqpConfig {
  host: string
  port: number
  vhost: string
  username: string
  password: string
  tls?: boolean
}

/**
 * Message handler function type
 * @param msg - The message to process
 * @param channel - The channel the message was received on
 * @returns void
 */
export type MessageHandler = (
  msg: ConsumeMessage,
  channel: Channel
) => Promise<void> | void

/**
 * Connection state enum for tracking AMQPConnector status
 */
export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting'
}

/**
 * Reconnection configuration options
 * @property enabled - Whether automatic reconnection is enabled (default: true)
 * @property initialDelayMs - Initial delay before first reconnection attempt (default: 1000)
 * @property maxDelayMs - Maximum delay between reconnection attempts (default: 30000)
 * @property maxRetries - Maximum number of reconnection attempts, 0 for infinite (default: 0)
 * @property backoffMultiplier - Multiplier for exponential backoff (default: 2)
 */
export interface ReconnectionConfig {
  enabled?: boolean
  initialDelayMs?: number
  maxDelayMs?: number
  maxRetries?: number
  backoffMultiplier?: number
}

/**
 * Default reconnection configuration values
 */
export const DEFAULT_RECONNECTION_CONFIG: Required<ReconnectionConfig> = {
  enabled: true,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  maxRetries: 0,
  backoffMultiplier: 2
}
