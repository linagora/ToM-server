/**
 * Base class for all amqp-connector-related errors.
 * @class AMQPConnectorError
 * @extends Error
 */
export class AMQPConnectorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AMQPConnectorError'
  }
}

/**
 * Error thrown when the queue is not specified.
 * @class QueueNotSpecifiedError
 * @extends AMQPConnectorError
 */
export class ExchangeNotSpecifiedError extends AMQPConnectorError {
  constructor() {
    super('Exchange must be specified')
    this.name = 'ExchangeNotSpecifiedError'
  }
}

/**
 * Error thrown when the queue is not specified.
 * @class QueueNotSpecifiedError
 * @extends AMQPConnectorError
 */
export class QueueNotSpecifiedError extends AMQPConnectorError {
  constructor() {
    super('Queue must be specified')
    this.name = 'QueueNotSpecifiedError'
  }
}
/**
 * Error thrown when the message handler is not provided.
 * @class MessageHandlerNotProvidedError
 * @extends AMQPConnectorError
 */
export class MessageHandlerNotProvidedError extends AMQPConnectorError {
  constructor() {
    super('Message handler must be provided')
    this.name = 'MessageHandlerNotProvidedError'
  }
}
