import amqplib, { type Options } from 'amqplib'
import { type TwakeLogger } from '@twake-chat/logger'
import {
  type AmqpConfig,
  type MessageHandler,
  ConnectionState,
  type ReconnectionConfig,
  DEFAULT_RECONNECTION_CONFIG
} from './types.ts'
import {
  QueueNotSpecifiedError,
  MessageHandlerNotProvidedError,
  ExchangeNotSpecifiedError
} from './errors.ts'

export { ConnectionState, type ReconnectionConfig } from './types'

export class AMQPConnector {
  private readonly logger?: TwakeLogger
  private url: string = ''
  private exchange?: string
  private queue?: string
  private routingKey: string = '#'
  private exchangeOptions: Options.AssertExchange = { durable: true }
  private queueOptions: Options.AssertQueue = { durable: true }
  private onMessageHandler?: MessageHandler
  private connection?: amqplib.ChannelModel
  private channel?: amqplib.Channel

  // Reconnection properties
  private connectionState: ConnectionState = ConnectionState.Disconnected
  private reconnectionConfig: Required<ReconnectionConfig> = {
    ...DEFAULT_RECONNECTION_CONFIG
  }
  private reconnectAttempts: number = 0
  private reconnectTimeoutId?: ReturnType<typeof setTimeout>
  private isIntentionalClose: boolean = false
  private consumerTag?: string

  /**
   * Constructor for AMQPConnector
   * @param logger - Optional TwakeLogger instance for logging
   */
  constructor(logger?: TwakeLogger) {
    this.logger = logger
  }

  /**
   * Set the AMQP server URL using structured configuration
   * @param conf - AMQP structured configuration
   * @returns this
   */
  withConfig(conf: AmqpConfig): this {
    const protocol = conf.tls === true ? 'amqps' : 'amqp'
    const url = `${protocol}://${encodeURIComponent(
      conf.username
    )}:${encodeURIComponent(conf.password)}@${conf.host}:${conf.port}/${
      conf.vhost
    }`
    return this.withUrl(url)
  }

  /**
   * Set the AMQP server URL
   * @param url - AMQP server URL
   * @returns this
   */
  withUrl(url: string): this {
    this.url = url
    return this
  }

  withExchange(
    exchange: string,
    options: Options.AssertExchange = { durable: true }
  ): this {
    this.exchange = exchange
    this.exchangeOptions = options
    return this
  }

  /**
   * Set the queue name and options
   * @param queue - Queue name
   * @param options - Queue options (default: { durable: true })
   * @returns this
   */
  withQueue(
    queue: string,
    options: Options.AssertQueue = { durable: true },
    routingKey?: string
  ): this {
    this.queue = queue
    this.queueOptions = options
    if (routingKey != null) this.routingKey = routingKey
    return this
  }

  /**
   * Set the message handler function
   * @param handler - Message handler function
   * @returns this
   */
  onMessage(handler: MessageHandler): this {
    this.onMessageHandler = handler
    return this
  }

  /**
   * Configure reconnection behavior
   * @param config - Reconnection configuration options
   * @returns this
   */
  withReconnection(config: ReconnectionConfig): this {
    this.reconnectionConfig = {
      ...DEFAULT_RECONNECTION_CONFIG,
      ...config
    }
    return this
  }

  /**
   * Get the current connection state
   * @returns The current ConnectionState
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Check if the connector is currently connected
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.Connected
  }

  /**
   * Build and start the connector
   * @throws QueueNotSpecifiedError if queue is not specified
   * @throws MessageHandlerNotProvidedError if message handler is not provided
   * @returns Promise that resolves when the connector is built and started
   */
  async build(): Promise<void> {
    if (this.exchange == null || this.exchange === undefined)
      throw new ExchangeNotSpecifiedError()

    if (this.queue == null || this.queue === undefined)
      throw new QueueNotSpecifiedError()

    if (this.onMessageHandler == null)
      throw new MessageHandlerNotProvidedError()

    // Clear any pending reconnect timer to avoid overlapping connection attempts
    if (this.reconnectTimeoutId != null) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = undefined
    }

    // Reset state for fresh build
    this.isIntentionalClose = false
    this.reconnectAttempts = 0
    this.connectionState = ConnectionState.Connecting

    this.logger?.info(`[AMQPConnector] Connecting to AMQP server...`)

    try {
      this.connection = await amqplib.connect(this.url)

      // Set up channel with exchange, queue, bindings, and consumer
      await this.setupChannel()

      this.logger?.info(
        `[AMQPConnector] Connected and listening on queue: ${this.queue}`
      )

      // Check if close() was called during connection establishment
      if (this.isIntentionalClose) {
        await this.cleanupResources()
        this.logger?.info(
          '[AMQPConnector] Connection closed during build - close() was called concurrently.'
        )
        return
      }

      // Set up event handlers for automatic reconnection
      this.setupConnectionEventHandlers()

      this.connectionState = ConnectionState.Connected
    } catch (error) {
      this.logger?.debug(
        `[AMQPConnector] Connection failed, cleaning up partial resources: ${
          (error as Error).message
        }`
      )
      await this.cleanupResources()
      throw error
    }
  }

  /**
   * Close the connection and channel
   * @returns Promise that resolves when the connection and channel are closed
   */
  async close(): Promise<void> {
    // Mark as intentional close to prevent reconnection
    this.isIntentionalClose = true

    await this.cleanupResources()

    this.logger?.info(`[AMQPConnector] Connection closed.`)
  }

  /**
   * Get the current channel
   * @returns The current channel or undefined if not connected
   */
  getChannel(): amqplib.Channel | undefined {
    return this.channel
  }

  /**
   * Clean up all AMQP resources (consumer, channel, connection)
   * @returns Promise that resolves when cleanup is complete
   */
  private async cleanupResources(): Promise<void> {
    if (this.consumerTag != null && this.channel != null) {
      try {
        await this.channel.cancel(this.consumerTag)
      } catch {
        // Ignore errors during cleanup
      }
      this.consumerTag = undefined
    }

    if (this.reconnectTimeoutId != null) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = undefined
    }

    await this.channel?.close().catch(() => {})
    await this.connection?.close().catch(() => {})

    this.channel = undefined
    this.connection = undefined
    this.connectionState = ConnectionState.Disconnected
  }

  /**
   * Set up or recreate a channel on an existing connection.
   * This method creates a new channel, asserts exchange/queue, binds them,
   * starts consuming, and sets up channel event handlers.
   * @throws Error if connection is not available
   * @returns Promise that resolves when the channel is set up
   */
  private async setupChannel(): Promise<void> {
    if (this.connection == null) {
      throw new Error('Cannot setup channel without connection')
    }

    if (this.exchange == null || this.queue == null) {
      throw new Error('Cannot setup channel: exchange or queue not configured')
    }

    this.channel = await this.connection.createChannel()

    await this.channel.assertExchange(
      this.exchange,
      'topic',
      this.exchangeOptions
    )
    await this.channel.assertQueue(this.queue, this.queueOptions)
    await this.channel.bindQueue(this.queue, this.exchange, this.routingKey)

    const consumeResult = await this.channel.consume(
      this.queue,
      this.createMessageConsumer(),
      { noAck: false }
    )

    this.consumerTag = consumeResult.consumerTag

    // Set up channel event handlers
    this.channel.on('error', (error: Error) => {
      this.logger?.error(`[AMQPConnector] Channel error: ${error.message}`)
    })

    this.channel.on('close', () => {
      this.logger?.warn('[AMQPConnector] Channel closed')
      this.channel = undefined
      this.consumerTag = undefined

      // Recreate channel if connection still exists and not intentionally closing
      if (!this.isIntentionalClose && this.connection != null) {
        this.logger?.info('[AMQPConnector] Attempting to recreate channel...')
        this.setupChannel().catch((error) => {
          this.logger?.error(
            `[AMQPConnector] Failed to recreate channel: ${
              (error as Error).message
            }`
          )
          // If channel recreation fails, trigger full reconnection
          if (!this.isIntentionalClose && this.reconnectionConfig.enabled) {
            this.scheduleReconnection()
          }
        })
      }
    })
  }

  /**
   * Create the message consumer callback
   * @returns The consumer callback function
   */
  private createMessageConsumer(): (
    msg: amqplib.ConsumeMessage | null
  ) => Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return async (msg) => {
      if (msg != null) {
        // Capture channel reference to avoid race conditions
        const channel = this.channel
        if (channel == null) {
          this.logger?.warn(
            '[AMQPConnector] Message received but channel is unavailable. Message will be redelivered.'
          )
          return
        }

        try {
          await this.onMessageHandler?.(msg, channel)
          channel.ack(msg)
        } catch (error) {
          this.logger?.error(
            `[AMQPConnector] Error processing message: ${
              (error as Error).message
            }`
          )
          channel.nack(msg, false, false)
        }
      }
    }
  }

  /**
   * Set up event handlers for connection error and close events.
   * Note: Channel event handlers are set up in setupChannel().
   */
  private setupConnectionEventHandlers(): void {
    if (this.connection == null) return

    this.connection.on('error', (error: Error) => {
      this.logger?.error(`[AMQPConnector] Connection error: ${error.message}`)
      // Note: 'close' event will be emitted after 'error', so reconnection
      // will be triggered by the 'close' handler
    })

    this.connection.on('close', () => {
      this.logger?.warn('[AMQPConnector] Connection closed')
      this.connectionState = ConnectionState.Disconnected
      this.channel = undefined
      this.connection = undefined
      this.consumerTag = undefined

      // Only attempt reconnection if this was not an intentional close
      if (!this.isIntentionalClose && this.reconnectionConfig.enabled) {
        this.scheduleReconnection()
      }
    })
  }

  /**
   * Calculate the delay for the next reconnection attempt using exponential backoff
   * @returns Delay in milliseconds
   */
  private calculateReconnectDelay(): number {
    const { initialDelayMs, maxDelayMs, backoffMultiplier } =
      this.reconnectionConfig
    const delay = Math.min(
      initialDelayMs * Math.pow(backoffMultiplier, this.reconnectAttempts),
      maxDelayMs
    )
    // Add jitter (0-10% random variation) to prevent thundering herd
    const jitter = delay * 0.1 * Math.random()
    return Math.floor(delay + jitter)
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnection(): void {
    const { maxRetries } = this.reconnectionConfig

    // Check if max retries exceeded (0 means infinite)
    if (maxRetries > 0 && this.reconnectAttempts >= maxRetries) {
      this.logger?.error(
        `[AMQPConnector] Max reconnection attempts (${maxRetries}) exceeded. Giving up.`
      )
      this.connectionState = ConnectionState.Disconnected
      return
    }

    const delay = this.calculateReconnectDelay()
    this.reconnectAttempts++

    this.logger?.info(
      `[AMQPConnector] Scheduling reconnection attempt ${this.reconnectAttempts}` +
        `${maxRetries > 0 ? `/${maxRetries}` : ''} in ${delay}ms`
    )

    this.connectionState = ConnectionState.Reconnecting

    this.reconnectTimeoutId = setTimeout(() => {
      this.attemptReconnection().catch((error) => {
        this.logger?.error(
          `[AMQPConnector] Reconnection attempt failed: ${
            (error as Error).message
          }`
        )
        // Schedule next attempt
        this.scheduleReconnection()
      })
    }, delay)
  }

  /**
   * Attempt to reconnect to the AMQP server
   */
  private async attemptReconnection(): Promise<void> {
    // Safety check: abort if close was called during reconnection scheduling
    if (this.isIntentionalClose) {
      this.logger?.info(
        '[AMQPConnector] Reconnection aborted: intentional close in progress'
      )
      return
    }

    this.logger?.info('[AMQPConnector] Attempting to reconnect...')
    this.connectionState = ConnectionState.Connecting

    try {
      // Establish new connection
      this.connection = await amqplib.connect(this.url)

      // Set up channel with exchange, queue, bindings, and consumer
      await this.setupChannel()

      // Check if close() was called during reconnection establishment
      if (this.isIntentionalClose) {
        await this.cleanupResources()
        this.logger?.info(
          '[AMQPConnector] Reconnection aborted: close() was called concurrently.'
        )
        return
      }

      // Set up event handlers for the new connection
      this.setupConnectionEventHandlers()

      // Reset reconnection state on successful connection
      this.reconnectAttempts = 0
      this.connectionState = ConnectionState.Connected

      this.logger?.info(
        `[AMQPConnector] Successfully reconnected and listening on queue: ${this.queue}`
      )
    } catch (error) {
      this.logger?.debug(
        `[AMQPConnector] Reconnection failed, cleaning up partial resources: ${
          (error as Error).message
        }`
      )
      await this.cleanupResources()
      throw error
    }
  }
}

export default AMQPConnector
