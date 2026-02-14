/**
 * A base class for all custom errors thrown by the URL building utility.
 * This allows for catching all URL-related errors with a single `catch` block.
 */
export class UrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrlError'
  }
}

/**
 * Thrown when a required argument (e.g., the base URL) is missing or empty.
 */
export class MissingArgumentError extends UrlError {
  constructor(argumentName: string) {
    super(`The "${argumentName}" argument is required and cannot be empty.`)
    this.name = 'MissingArgumentError'
  }
}

/**
 * Thrown when the provided base URL is invalid and cannot be parsed, even after
 * attempting to prepend a protocol.
 */
export class InvalidUrlError extends UrlError {
  constructor(url: string, cause?: unknown) {
    super(`The provided base URL "${url}" is invalid.`)
    this.name = 'InvalidUrlError'
    if (cause) {
      this.cause = cause
    }
  }
}

/**
 * Thrown when a path is invalid or potentially dangerous.
 */
export class InvalidPathError extends UrlError {
  constructor(path: string, reason: string) {
    super(`The provided path "${path}" is invalid: ${reason}`)
    this.name = 'InvalidPathError'
  }
}
