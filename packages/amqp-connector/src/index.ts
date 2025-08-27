import amqplib, { type Options } from 'amqplib'
import { type MessageHandler } from './types'
import {
  QueueNotSpecifiedError,
  MessageHandlerNotProvidedError
} from './errors'

export class AMQPConnector {
  private url: string = ''
  private queue?: string
  private options: Options.AssertQueue = { durable: true }
  private onMessageHandler?: MessageHandler
  private connection?: amqplib.ChannelModel
  private channel?: amqplib.Channel

  /**
   * Set the AMQP server URL
   * @param url - AMQP server URL
   * @returns this
   */
  withUrl(url: string): this {
    this.url = url
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
    options: Options.AssertQueue = { durable: true }
  ): this {
    this.queue = queue
    this.options = options
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

    this.connection = await amqplib.connect(this.url)
    this.channel = await this.connection.createChannel()
    await this.channel.assertQueue(this.queue, this.options)
    await this.channel.consume(
      this.queue,
      (msg) => {
        if (msg != null) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.onMessageHandler!(msg, this.channel!)
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
    await this.channel?.close().catch(() => {})
    await this.connection?.close().catch(() => {})
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
