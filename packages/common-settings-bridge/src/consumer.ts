/**
 * RabbitMQ consumer for common-settings-bridge
 * Uses AMQPConnector from @twake/amqp-connector
 */

import { type TwakeLogger } from '@twake/logger'
import { AMQPConnector, type AmqpConfig } from '@twake/amqp-connector'
import {
  type RabbitMQConfig,
  type QueueConfig,
  type CommonSettingsMessage
} from './types'
import { MessageParseError, MessageValidationError } from './errors'

/**
 * Message handler callback type
 */
export type MessageHandler = (message: CommonSettingsMessage) => Promise<void>

/**
 * RabbitMQ consumer wrapper
 */
export class SettingsConsumer {
  private readonly logger: TwakeLogger
  private readonly connector: AMQPConnector
  private readonly queueConfig: QueueConfig
  private messageHandler: MessageHandler | null = null
  private _started: boolean = false

  constructor(
    rabbitConfig: RabbitMQConfig,
    queueConfig: QueueConfig,
    logger: TwakeLogger
  ) {
    this.logger = logger
    this.queueConfig = queueConfig

    // Convert to AMQPConnector config format
    const amqpConfig: AmqpConfig = {
      host: rabbitConfig.host,
      port: rabbitConfig.port,
      username: rabbitConfig.username,
      password: rabbitConfig.password,
      vhost: rabbitConfig.vhost,
      tls: rabbitConfig.tls
    }

    // Build queue options
    const queueOptions: Record<string, any> = {
      durable: true
    }
    if (queueConfig.deadLetterExchange) {
      queueOptions.deadLetterExchange = queueConfig.deadLetterExchange
    }
    if (queueConfig.deadLetterRoutingKey) {
      queueOptions.deadLetterRoutingKey = queueConfig.deadLetterRoutingKey
    }

    // Initialize connector
    this.connector = new AMQPConnector(logger)
      .withConfig(amqpConfig)
      .withExchange(queueConfig.exchange, { durable: true })
      .withQueue(queueConfig.name, queueOptions, queueConfig.routingKey)
      .onMessage(this.handleRawMessage.bind(this))
  }

  /**
   * Check if consumer is started
   */
  get isStarted(): boolean {
    return this._started
  }

  /**
   * Set the message handler
   * @param handler Function to handle parsed messages
   */
  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    if (this._started) {
      this.logger.warn('[SettingsConsumer] Consumer already started')
      return
    }

    this.logger.info('[SettingsConsumer] Starting consumer...', {
      queue: this.queueConfig.name,
      exchange: this.queueConfig.exchange
    })

    await this.connector.build()
    this._started = true

    this.logger.info(
      '[SettingsConsumer] Consumer started and listening for messages'
    )
  }

  /**
   * Handle raw AMQP message
   * @param rawMsg The raw AMQP message
   */
  private async handleRawMessage(rawMsg: any): Promise<void> {
    const rawContent = rawMsg.content.toString()

    this.logger.debug('[SettingsConsumer] Received raw message', {
      raw: rawContent.substring(0, 200)
    })

    // Parse message
    const message = this.parseMessage(rawContent)
    if (message === null) {
      throw new MessageParseError()
    }

    // Validate message
    this.validateMessage(message)

    // Forward to handler
    if (this.messageHandler) {
      await this.messageHandler(message)
    } else {
      this.logger.warn(
        '[SettingsConsumer] No message handler set, message ignored'
      )
    }
  }

  /**
   * Parse raw JSON message
   * @param raw The raw JSON string
   * @returns Parsed message or null if parsing fails
   */
  private parseMessage(raw: string): CommonSettingsMessage | null {
    try {
      return JSON.parse(raw) as CommonSettingsMessage
    } catch (error: any) {
      this.logger.warn('[SettingsConsumer] Failed to parse message', {
        error: error.message,
        raw: raw.substring(0, 200)
      })
      return null
    }
  }

  /**
   * Validate message has required fields
   * @param message The parsed message
   * @throws MessageValidationError if validation fails
   */
  private validateMessage(message: CommonSettingsMessage): void {
    if (!message.payload) {
      throw new MessageValidationError('payload')
    }
    if (!message.payload.matrix_id) {
      throw new MessageValidationError('payload.matrix_id')
    }
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    if (!this._started) {
      return
    }

    this.logger.info('[SettingsConsumer] Stopping consumer...')
    await this.connector.close()
    this._started = false
    this.logger.info('[SettingsConsumer] Consumer stopped')
  }
}
