import fs from 'fs';

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'json';

export interface ConfigProperty {
  type: ConfigValueType;
  default?: any;
}

export interface ConfigDescription {
  [key: string]: ConfigProperty;
}

export type ConfigurationFile = object | fs.PathOrFileDescriptor | undefined;

// --- Custom Error Types ---

/**
 * Base custom error for configuration parsing.
 */
class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Error thrown when a string cannot be coerced to a number.
 */
class InvalidNumberFormatError extends ConfigError {
  constructor(value: string) {
    super(`Invalid number format for value: '${value}'`);
    this.name = 'InvalidNumberFormatError';
  }
}

/**
 * Error thrown when a string cannot be coerced to a boolean.
 */
class InvalidBooleanFormatError extends ConfigError {
  constructor(value: string) {
    super(`Invalid boolean format for value: '${value}'. Expected 'true', 'false', '1', or '0'.`);
    this.name = 'InvalidBooleanFormatError';
  }
}

/**
 * Error thrown when a string cannot be parsed as JSON.
 */
class InvalidJsonFormatError extends ConfigError {
  constructor(value: string, originalError: Error) {
    super(`Invalid JSON format for value: '${value}'. Error: ${originalError.message}`);
    this.name = 'InvalidJsonFormatError';
    this.cause = originalError;
  }
}

/**
 * Error thrown when a configuration file cannot be read or parsed.
 */
class FileReadParseError extends ConfigError {
  constructor(filePath: string, originalError: Error) {
    super(`Failed to read or parse configuration file '${filePath}': ${originalError.message}`);
    this.name = 'FileReadParseError';
    this.cause = originalError;
  }
}

/**
 * Error thrown when an unaccepted key is found in the configuration.
 */
class UnacceptedKeyError extends ConfigError {
  constructor(key: string) {
    super(`Configuration key '${key}' isn't accepted as it's not defined in the ConfigDescription.`);
    this.name = 'UnacceptedKeyError';
  }
}

/**
 * Error thrown when a coercion fails during configuration processing, wrapping a more specific error.
 */
class ConfigCoercionError extends ConfigError {
  constructor(key: string, source: 'environment' | 'default', originalError: Error) {
    const sourceMsg = source === 'environment' ? `from environment variable '${key.toUpperCase()}'` : `for default value of '${key}'`;
    super(`Configuration error for '${key}' ${sourceMsg}: ${originalError.message}`);
    this.name = 'ConfigCoercionError';
    this.cause = originalError;
  }
}


/**
 * Coerces a string value from an environment variable to the target type.
 * @param value The string value.
 * @param targetType The desired type.
 * @returns The coerced value.
 * @throws InvalidNumberFormatError if coercion to number fails.
 * @throws InvalidBooleanFormatError if coercion to boolean fails.
 * @throws InvalidJsonFormatError if coercion to JSON fails.
 */
const coerceValue = (value: string, targetType: ConfigValueType): any => {
  switch (targetType) {
    case 'number':
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new InvalidNumberFormatError(value);
      }
      return num;
    case 'boolean':
      const lowerValue = value.toLowerCase().trim();
      if (lowerValue === 'true' || lowerValue === '1') {
        return true;
      }
      if (lowerValue === 'false' || lowerValue === '0') {
        return false;
      }
      throw new InvalidBooleanFormatError(value);
    case 'array':
      return value.split(/[,\s]+/).filter(s => s.length > 0);
    case 'json':
      try {
        return JSON.parse(value);
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        throw new InvalidJsonFormatError(value, error);
      }
    case 'string':
    case 'object':
    default:
      return value;
  }
};

/**
 * Loads and consolidates application configuration.
 * @param desc The ConfigDescription defining expected keys, types, and defaults.
 * @param defaultConfigurationFile An optional base configuration object or path to a JSON file.
 * @param useEnv Whether to use environment variables for overrides. Defaults to false.
 * @returns The consolidated configuration object with coerced types.
 * @throws FileReadParseError if reading/parsing the configuration file fails.
 * @throws UnacceptedKeyError if a key isn't accepted (not defined in ConfigDescription).
 * @throws ConfigCoercionError if type coercion fails for environment variables or default values.
 */
const twakeConfig = (
  desc: ConfigDescription,
  defaultConfigurationFile?: ConfigurationFile,
  useEnv: boolean = false
): Record<string, any> => {
  let res: { [key: string]: any } = {};

  if (defaultConfigurationFile != null) {
    if (typeof defaultConfigurationFile === 'string') {
      try {
        const fileContent = fs.readFileSync(defaultConfigurationFile).toString();
        res = JSON.parse(fileContent);
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        throw new FileReadParseError(defaultConfigurationFile, error);
      }
    } else {
      res = JSON.parse(JSON.stringify(defaultConfigurationFile));
    }
  }

  Object.keys(desc).forEach((key: string) => {
    const configProp = desc[key];
    const envVarName = key.toUpperCase();
    const envValue = process.env[envVarName];

    if (useEnv && envValue != null && envValue !== '') {
      try {
        res[key] = coerceValue(envValue, configProp.type);
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        throw new ConfigCoercionError(key, 'environment', error);
      }
    } else {
      if (res[key] == null && configProp.default !== undefined) {
        if (typeof configProp.default === 'string' && configProp.type !== 'string') {
          try {
            res[key] = coerceValue(configProp.default, configProp.type);
          } catch (e: unknown) {
            const error = e instanceof Error ? e : new Error(String(e));
            throw new ConfigCoercionError(key, 'default', error);
          }
        } else {
          res[key] = configProp.default;
        }
      }
    }
  });

  Object.keys(res).forEach((key: string) => {
    if (desc[key] === undefined) {
      throw new UnacceptedKeyError(key);
    }
  });

  return res;
};

export default twakeConfig;
