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
