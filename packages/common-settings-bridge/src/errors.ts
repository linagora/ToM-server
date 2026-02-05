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
