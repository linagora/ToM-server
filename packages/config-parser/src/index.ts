import fs from 'fs'
import { promises as fsPromises } from 'fs'

/**
 * Defines the possible types for configuration values.
 * @typedef {'string' | 'number' | 'boolean' | 'array' | 'object' | 'json'} ConfigValueType
 */
export type ConfigValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'json'

/**
 * Defines the properties of a single configuration key.
 * @interface ConfigProperty
 * @property {ConfigValueType} type - The expected data type of the configuration value.
 * @property {any} [default] - The optional default value for the configuration key.
 * @property {boolean} [required] - Indicates if the configuration key is mandatory.
 */
export interface ConfigProperty {
  type: ConfigValueType
  default?: any
  required?: boolean
}

/**
 * Defines the overall structure of the configuration, mapping keys to their properties.
 * @interface ConfigDescription
 * @property {Object.<string, ConfigProperty>} [key: string] - A mapping of configuration keys to their respective ConfigProperty definitions.
 */
export interface ConfigDescription {
  [key: string]: ConfigProperty
}

/**
 * Defines the possible types for the default configuration file input.
 * It can be an object representing configuration or a file path.
 * @typedef {object | fs.PathOrFileDescriptor | undefined} ConfigurationFile
 */
export type ConfigurationFile = object | fs.PathOrFileDescriptor | undefined

/**
 * Represents the consolidated configuration object, where keys are strings and values can be of any type.
 * @typedef {Record<string, any>} Configuration
 */
export type Configuration = Record<string, any>

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

/**
 * Coerces a string value to the target type.
 * @param {string} value - The string value to coerce.
 * @param {ConfigValueType} targetType - The desired type.
 * @returns {any} The coerced value.
 * @throws {InvalidNumberFormatError} if coercion to number fails.
 * @throws {InvalidBooleanFormatError} if coercion to boolean fails.
 * @throws {InvalidJsonFormatError} if coercion to JSON fails.
 */
const coerceValue = (value: string, targetType: ConfigValueType): any => {
  switch (targetType) {
    case 'number':
      const num = parseFloat(value)
      if (isNaN(num)) {
        throw new InvalidNumberFormatError(value)
      }
      return num
    case 'boolean':
      const lowerValue = value.toLowerCase().trim()
      if (lowerValue === 'true' || lowerValue === '1') {
        return true
      }
      if (lowerValue === 'false' || lowerValue === '0') {
        return false
      }
      throw new InvalidBooleanFormatError(value)
    case 'array':
      return value.split(/[,\s]+/).filter((s) => s.length > 0)
    case 'json':
    case 'object':
      try {
        return JSON.parse(value)
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e))
        throw new InvalidJsonFormatError(value, error)
      }
    case 'string':
    default:
      return value
  }
}

/**
 * Loads configuration from a specified file path.
 * @param {fs.PathOrFileDescriptor} filePath - The path to the configuration JSON file.
 * @returns {Promise<Configuration>} The parsed configuration object from the file.
 * @throws {FileReadParseError} if the file cannot be read or parsed.
 */
const loadConfigFromFile = async (filePath: string): Promise<Configuration> => {
  try {
    const fileContent = await fsPromises.readFile(filePath, 'utf8')
    return JSON.parse(fileContent)
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e))
    throw new FileReadParseError(filePath, error)
  }
}

/**
 * Applies environment variable overrides to the configuration.
 * @param {Configuration} config - The current configuration object to modify.
 * @param {ConfigDescription} desc - The ConfigDescription for type information.
 * @param {boolean} useEnv - Whether to enable environment variable overrides.
 * @throws {ConfigCoercionError} if an environment variable value cannot be coerced to the expected type.
 */
const applyEnvironmentVariables = (
  config: Configuration,
  desc: ConfigDescription,
  useEnv: boolean
): void => {
  Object.keys(desc).forEach((key: string) => {
    const configProp = desc[key]
    const envVarName = key.toUpperCase()
    const envValue = process.env[envVarName]

    if (useEnv && envValue != null && envValue !== '') {
      try {
        config[key] = coerceValue(envValue, configProp.type)
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e))
        throw new ConfigCoercionError(key, 'environment', error)
      }
    }
  })
}

/**
 * Applies default values from ConfigDescription if a key is not already set.
 * Coerces string defaults if their target type is not string.
 * @param {Configuration} config - The current configuration object to modify.
 * @param {ConfigDescription} desc - The ConfigDescription for default values and type information.
 * @throws {ConfigCoercionError} if a default value string cannot be coerced to its expected type.
 */
const applyDefaultValues = (
  config: Configuration,
  desc: ConfigDescription
): void => {
  Object.keys(desc).forEach((key: string) => {
    const configProp = desc[key]
    if (config[key] == null && configProp.default !== undefined) {
      if (
        typeof configProp.default === 'string' &&
        configProp.type !== 'string' &&
        configProp.type !== 'array'
      ) {
        try {
          config[key] = coerceValue(configProp.default, configProp.type)
        } catch (e: unknown) {
          const error = e instanceof Error ? e : new Error(String(e))
          throw new ConfigCoercionError(key, 'default', error)
        }
      } else if (
        typeof configProp.default === 'string' &&
        configProp.type === 'array'
      ) {
        try {
          config[key] = coerceValue(configProp.default, configProp.type)
        } catch (e: unknown) {
          const error = e instanceof Error ? e : new Error(String(e))
          throw new ConfigCoercionError(key, 'default', error)
        }
      } else {
        config[key] = configProp.default
      }
    }
  })
}

/**
 * Validates that all keys in the final configuration are defined in the ConfigDescription.
 * @param {Configuration} config - The final consolidated configuration object.
 * @param {ConfigDescription} desc - The ConfigDescription.
 * @throws {UnacceptedKeyError} if an unexpected key is found in the configuration.
 */
const validateUnwantedKeys = (
  config: Configuration,
  desc: ConfigDescription
): void => {
  Object.keys(config).forEach((key: string) => {
    if (desc[key] === undefined) {
      throw new UnacceptedKeyError(key)
    }
  })
}

/**
 * Validates that all required configuration keys are present in the final configuration.
 * @param {Configuration} config - The final consolidated configuration object.
 * @param {ConfigDescription} desc - The ConfigDescription.
 * @throws {MissingRequiredConfigError} if a required key is missing.
 */
const validateRequiredKeys = (
  config: Configuration,
  desc: ConfigDescription
): void => {
  Object.keys(desc).forEach((key: string) => {
    const configProp = desc[key]
    if (configProp.required && config[key] === undefined) {
      throw new MissingRequiredConfigError(key)
    }
  })
}

/**
 * Loads and consolidates application configuration from multiple sources.
 * The priority order is: defaultConfigurationFile > environment variables > ConfigDescription defaults.
 *
 * @param {ConfigDescription} desc - The ConfigDescription defining expected keys, types, defaults, and required status.
 * @param {ConfigurationFile} [defaultConfigurationFile] - An optional base configuration object or path to a JSON file.
 * @param {boolean} [useEnv=false] - Whether to use environment variables for overrides. Defaults to false.
 * @returns {Promise<Configuration>} The consolidated configuration object with coerced types.
 * @throws {FileReadParseError} if reading/parsing the configuration file fails.
 * @throws {UnacceptedKeyError} if a key isn't accepted (not defined in ConfigDescription).
 * @throws {ConfigCoercionError} if type coercion fails for environment variables or default values.
 * @throws {MissingRequiredConfigError} if a required configuration key is missing.
 */
const twakeConfig = async (
  desc: ConfigDescription,
  defaultConfigurationFile?: ConfigurationFile,
  useEnv: boolean = false
): Promise<Configuration> => {
  let config: Configuration = {}

  if (defaultConfigurationFile != null) {
    if (typeof defaultConfigurationFile === 'string') {
      config = await loadConfigFromFile(defaultConfigurationFile)
    } else {
      config = JSON.parse(JSON.stringify(defaultConfigurationFile))
    }
  }

  applyEnvironmentVariables(config, desc, useEnv)
  applyDefaultValues(config, desc)
  validateUnwantedKeys(config, desc)
  validateRequiredKeys(config, desc)

  return config
}

export default twakeConfig
