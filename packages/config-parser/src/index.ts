import fs from 'fs'
import { promises as fsPromises } from 'fs'

export type ConfigValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'json'

export interface ConfigProperty {
  type: ConfigValueType
  default?: any
  required?: boolean
}

export interface ConfigDescription {
  [key: string]: ConfigProperty
}

export type ConfigurationFile = object | fs.PathOrFileDescriptor | undefined

/**
 * @typedef {Record<string, any>} Configuration - Represents the consolidated configuration object.
 */
export type Configuration = Record<string, any>

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export class InvalidNumberFormatError extends ConfigError {
  constructor(value: string) {
    super(`Invalid number format for value: '${value}'`)
    this.name = 'InvalidNumberFormatError'
  }
}

export class InvalidBooleanFormatError extends ConfigError {
  constructor(value: string) {
    super(
      `Invalid boolean format for value: '${value}'. Expected 'true', 'false', '1', or '0'.`
    )
    this.name = 'InvalidBooleanFormatError'
  }
}

export class InvalidJsonFormatError extends ConfigError {
  constructor(value: string, originalError: Error) {
    super(
      `Invalid JSON format for value: '${value}'. Error: ${originalError.message}`
    )
    this.name = 'InvalidJsonFormatError'
    this.cause = originalError
  }
}

export class FileReadParseError extends ConfigError {
  constructor(filePath: string, originalError: Error) {
    super(
      `Failed to read or parse configuration file '${filePath}': ${originalError.message}`
    )
    this.name = 'FileReadParseError'
    this.cause = originalError
  }
}

export class UnacceptedKeyError extends ConfigError {
  constructor(key: string) {
    super(
      `Configuration key '${key}' isn't accepted as it's not defined in the ConfigDescription.`
    )
    this.name = 'UnacceptedKeyError'
  }
}

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

export class MissingRequiredConfigError extends ConfigError {
  constructor(key: string) {
    super(`Required configuration key '${key}' is missing.`)
    this.name = 'MissingRequiredConfigError'
  }
}

/**
 * Coerces a string value to the target type.
 * @param value The string value to coerce.
 * @param targetType The desired type.
 * @returns The coerced value.
 * @throws InvalidNumberFormatError if coercion to number fails.
 * @throws InvalidBooleanFormatError if coercion to boolean fails.
 * @throws InvalidJsonFormatError if coercion to JSON fails.
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
 * @param filePath The path to the configuration JSON file.
 * @returns The parsed configuration object from the file.
 * @throws FileReadParseError if the file cannot be read or parsed.
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
 * @param config The current configuration object to modify.
 * @param desc The ConfigDescription for type information.
 * @param useEnv Whether to enable environment variable overrides.
 * @throws ConfigCoercionError if an environment variable value cannot be coerced to the expected type.
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
 * @param config The current configuration object to modify.
 * @param desc The ConfigDescription for default values and type information.
 * @throws ConfigCoercionError if a default value string cannot be coerced to its expected type.
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
 * @param config The final consolidated configuration object.
 * @param desc The ConfigDescription.
 * @throws UnacceptedKeyError if an unexpected key is found in the configuration.
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
 * @param config The final consolidated configuration object.
 * @param desc The ConfigDescription.
 * @throws MissingRequiredConfigError if a required key is missing.
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
 * @param desc The ConfigDescription defining expected keys, types, defaults, and required status.
 * @param defaultConfigurationFile An optional base configuration object or path to a JSON file.
 * @param useEnv Whether to use environment variables for overrides. Defaults to false.
 * @returns The consolidated configuration object with coerced types.
 * @throws FileReadParseError if reading/parsing the configuration file fails.
 * @throws UnacceptedKeyError if a key isn't accepted (not defined in ConfigDescription).
 * @throws ConfigCoercionError if type coercion fails for environment variables or default values.
 * @throws MissingRequiredConfigError if a required configuration key is missing.
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
