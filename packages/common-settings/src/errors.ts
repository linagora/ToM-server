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
 * Error thrown when AMQP URL is not provided
 * @class UrlNotProvidedError
 * @extends CommonSettingsError
 */
export class UrlNotProvidedError extends CommonSettingsError {
    constructor() {
        super('AMQP URL must be provided')
        this.name = 'UrlNotProvidedError'
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