/**
 * Errors used in Common Settings Connector
 * @class CommonSettingsError
 * @extends Error
 */
export class CommonSettingsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommonSettingsError'
  }
}

/**
 * Error thrown when AMQP Config is not provided
 * @class ConfigNotProvidedError
 * @extends CommonSettingsError
 */
export class ConfigNotProvidedError extends CommonSettingsError {
  constructor() {
    super('AMQP configuration must be provided')
    this.name = 'ConfigNotProvidedError'
  }
}

/**
 * Error thrown when Exchange name is not provided
 * @class ExchangeNotProvidedError
 * @extends CommonSettingsError
 */
export class ExchangeNotProvidedError extends CommonSettingsError {
  constructor() {
    super('Exchange name must be provided')
    this.name = 'ExchangeNotProvidedError'
  }
}

/**
 * Error thrown when Queue name is not provided
 * @class QueueNotProvidedError
 * @extends CommonSettingsError
 */
export class QueueNotProvidedError extends CommonSettingsError {
  constructor() {
    super('Queue name must be provided')
    this.name = 'QueueNotProvidedError'
  }
}

/**
 * Error thrown when User ID is not provided
 * @class UserIdNotProvidedError
 * @extends CommonSettingsError
 */
export class UserIdNotProvidedError extends CommonSettingsError {
  constructor() {
    super('User ID must be provided.')
    this.name = 'UserIdNotProvidedError'
  }
}

/**
 * Error thrown when User settings are not provided
 * @class UserSettingsNotProvidedError
 * @extends CommonSettingsError
 */
export class UserSettingsNotProvidedError extends CommonSettingsError {
  constructor() {
    super('User settings must be provided.')
    this.name = 'UserSettingsNotProvidedError'
  }
}
