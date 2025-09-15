import amqplib, { type Options } from 'amqplib'
import { type TwakeLogger } from '@twake/logger';
import { type AmqpConfig, type MessageHandler } from './types'
import {
  QueueNotSpecifiedError,
  MessageHandlerNotProvidedError
} from './errors'

export class AMQPConnector {
  private readonly logger?: TwakeLogger;
  private url: string = ''
  private exchange: string = ''
  private queue?: string
  private exchangeOptions: Options.AssertExchange = { durable: true }
  private queueOptions: Options.AssertQueue = { durable: true }
  private onMessageHandler?: MessageHandler
  private connection?: amqplib.ChannelModel
  private channel?: amqplib.Channel

  /**
   * Constructor for AMQPConnector
   * @param logger - Optional TwakeLogger instance for logging
   */
  constructor(logger?: TwakeLogger) {
    this.logger = logger;
  }


  /**
   * Set the AMQP server URL using structured configuration
   * @param conf - AMQP structured configuration
   * @returns this
   */
  withConfig(conf: AmqpConfig): this {
    const protocol = conf.tls === true ? "amqps" : "amqp";
    const url = `${protocol}://${encodeURIComponent(conf.username)}:${encodeURIComponent(conf.password)}@${conf.host}:${conf.port}/${conf.vhost}`;
    return this.withUrl(url);
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

  withExchange(exchange: string, options: Options.AssertExchange = { durable: true }): this {
    this.exchange = exchange;
    this.exchangeOptions = options;
    return this;
  }

  /**
   * Set the queue name and options
   * @param queue - Queue name
   * @param options - Queue options (default: { durable: true })
   * @returns this
   */
  withQueue(
    queue: string,
    options: Options.AssertQueue = { durable: true }
  ): this {
    this.queue = queue
    this.queueOptions = options
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
   * Build and start the connector
   * @throws QueueNotSpecifiedError if queue is not specified
   * @throws MessageHandlerNotProvidedError if message handler is not provided
   * @returns Promise that resolves when the connector is built and started
   */
  async build(): Promise<void> {
    if (this.queue == null || this.queue === undefined)
      throw new QueueNotSpecifiedError()
    if (this.onMessageHandler == null)
      throw new MessageHandlerNotProvidedError()

    this.logger?.info(`[AMQPConnector] Connecting to AMQP server...`);
    this.connection = await amqplib.connect(this.url)
    this.channel = await this.connection.createChannel()
    await this.channel.assertExchange(this.exchange, "topic", this.exchangeOptions);
    await this.channel.assertQueue(this.queue, this.queueOptions)
    await this.channel.bindQueue(this.queue, this.exchange, "#");
    this.logger?.info(`[AMQPConnector] Connected and listening on queue: ${this.queue}`);
    await this.channel.consume(
      this.queue,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg) => {
        if (msg != null) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await this.onMessageHandler?.(msg, this.channel!)
          this.channel?.ack(msg)
        }
      },
      { noAck: false }
    )
  }

  /**
   * Close the connection and channel
   * @returns Promise that resolves when the connection and channel are closeds
   */
  async close(): Promise<void> {
    await this.channel?.close().catch(() => { })
    await this.connection?.close().catch(() => { })
    this.logger?.info(`[AMQPConnector] Connection closed.`);
  }

  /**
   * Get the current channel
   * @returns The current channel or undefined if not connected
   */
  getChannel(): amqplib.Channel | undefined {
    return this.channel
  }
}

export default AMQPConnector
