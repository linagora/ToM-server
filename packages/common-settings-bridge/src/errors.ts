/**
 * Custom errors for common-settings-bridge
 */

/**
 * Base error class for common-settings-bridge
 */
export class CommonSettingsBridgeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommonSettingsBridgeError'
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends CommonSettingsBridgeError {
  constructor(message: string) {
    super(`Configuration error: ${message}`)
    this.name = 'ConfigurationError'
  }
}

/**
 * Error thrown when RabbitMQ config is missing
 */
export class RabbitMQConfigError extends ConfigurationError {
  constructor(field: string) {
    super(`RabbitMQ ${field} must be provided`)
    this.name = 'RabbitMQConfigError'
  }
}

/**
 * Error thrown when Synapse config is missing
 */
export class SynapseConfigError extends ConfigurationError {
  constructor(field: string) {
    super(`Synapse ${field} must be provided`)
    this.name = 'SynapseConfigError'
  }
}

/**
 * Error thrown when database config is missing
 */
export class DatabaseConfigError extends ConfigurationError {
  constructor(field: string) {
    super(`Database ${field} must be provided`)
    this.name = 'DatabaseConfigError'
  }
}

/**
 * Error thrown when message cannot be parsed
 */
export class MessageParseError extends CommonSettingsBridgeError {
  constructor(reason?: string) {
    super(
      reason ? `Failed to parse message: ${reason}` : 'Failed to parse message'
    )
    this.name = 'MessageParseError'
  }
}

/**
 * Error thrown when message validation fails
 */
export class MessageValidationError extends CommonSettingsBridgeError {
  constructor(field: string) {
    super(`Message validation failed: ${field} is required`)
    this.name = 'MessageValidationError'
  }
}

/**
 * Error thrown when Synapse bridge operation fails
 */
export class BridgeOperationError extends CommonSettingsBridgeError {
  constructor(operation: string, reason: string) {
    super(`Bridge operation '${operation}' failed: ${reason}`)
    this.name = 'BridgeOperationError'
  }
}

/**
 * Error thrown when database operation fails
 */
export class DatabaseOperationError extends CommonSettingsBridgeError {
  constructor(operation: string, reason: string) {
    super(`Database operation '${operation}' failed: ${reason}`)
    this.name = 'DatabaseOperationError'
  }
}

/**
 * Error thrown when avatar upload fails
 */
export class AvatarUploadError extends CommonSettingsBridgeError {
  constructor(userId: string, reason: string) {
    super(`Failed to upload avatar for ${userId}: ${reason}`)
    this.name = 'AvatarUploadError'
  }
}
