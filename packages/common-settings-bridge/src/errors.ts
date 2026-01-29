/**
 * Error thrown when configuration is not provided or is invalid.
 * This typically occurs during service initialization when required
 * configuration parameters are missing or malformed.
 */
export class ConfigNotProvidedError extends Error {
  constructor(message = 'Configuration not provided or invalid') {
    super(message)
    this.name = 'ConfigNotProvidedError'
  }
}

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
 * Error thrown when updating a user profile in Matrix fails.
 * This can occur due to network issues, invalid user IDs,
 * permission problems, or Matrix server errors.
 */
export class MatrixUpdateError extends Error {
  constructor(message = 'Failed to update user profile in Matrix') {
    super(message)
    this.name = 'MatrixUpdateError'
  }
}

/**
 * Error thrown when updating user settings in the database fails.
 * This can occur due to database connectivity issues, constraint violations,
 * or transaction failures.
 */
export class DatabaseUpdateError extends Error {
  constructor(message = 'Failed to update user settings in database') {
    super(message)
    this.name = 'DatabaseUpdateError'
  }
}
