/**
 * Base class for all configuration-related errors.
 * @class ConfigError
 * @extends Error
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/**
 * Error thrown when a string cannot be coerced to a number.
 * @class InvalidNumberFormatError
 * @extends ConfigError
 */
export class InvalidNumberFormatError extends ConfigError {
  constructor(value: string) {
    super(`Invalid number format for value: '${value}'`)
    this.name = 'InvalidNumberFormatError'
  }
}

/**
 * Error thrown when a string cannot be coerced to a boolean.
 * @class InvalidBooleanFormatError
 * @extends ConfigError
 */
export class InvalidBooleanFormatError extends ConfigError {
  constructor(value: string) {
    super(
      `Invalid boolean format for value: '${value}'. Expected 'true', 'false', '1', or '0'.`
    )
    this.name = 'InvalidBooleanFormatError'
  }
}

/**
 * Error thrown when a string cannot be parsed as JSON.
 * @class InvalidJsonFormatError
 * @extends ConfigError
 * @property {Error} cause - The original error that caused this error.
 */
export class InvalidJsonFormatError extends ConfigError {
  constructor(value: string, originalError: Error) {
    super(
      `Invalid JSON format for value: '${value}'. Error: ${originalError.message}`
    )
    this.name = 'InvalidJsonFormatError'
    this.cause = originalError
  }
}

/**
 * Error thrown when a configuration file cannot be read or parsed.
 * @class FileReadParseError
 * @extends ConfigError
 * @property {Error} cause - The original error that caused this error.
 */
export class FileReadParseError extends ConfigError {
  constructor(filePath: string, originalError: Error) {
    super(
      `Failed to read or parse configuration file '${filePath}': ${originalError.message}`
    )
    this.name = 'FileReadParseError'
    this.cause = originalError
  }
}

/**
 * Error thrown when an unexpected configuration key is encountered (not defined in ConfigDescription).
 * @class UnacceptedKeyError
 * @extends ConfigError
 */
export class UnacceptedKeyError extends ConfigError {
  constructor(key: string) {
    super(
      `Configuration key '${key}' isn't accepted as it's not defined in the ConfigDescription.`
    )
    this.name = 'UnacceptedKeyError'
  }
}

/**
 * Error thrown when type coercion fails for an environment variable or a default value.
 * @class ConfigCoercionError
 * @extends ConfigError
 * @property {Error} cause - The original error that caused this error.
 */
export class ConfigCoercionError extends ConfigError {
  constructor(
    key: string,
    source: 'environment' | 'default',
    originalError: Error
  ) {
    const sourceMsg =
      source === 'environment'
        ? `from environment variable '${key.toUpperCase()}'`
        : `for default value of '${key}'`
    super(
      `Configuration error for '${key}' ${sourceMsg}: ${originalError.message}`
    )
    this.name = 'ConfigCoercionError'
    this.cause = originalError
  }
}

/**
 * Error thrown when a required configuration key is missing.
 * @class MissingRequiredConfigError
 * @extends ConfigError
 */
export class MissingRequiredConfigError extends ConfigError {
  constructor(key: string) {
    super(`Required configuration key '${key}' is missing.`)
    this.name = 'MissingRequiredConfigError'
  }
}
