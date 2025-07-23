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

/**
 * Coerces a string value from an environment variable to the target type.
 * @param value The string value.
 * @param targetType The desired type.
 * @returns The coerced value.
 * @throws Error if coercion fails.
 */
const coerceValue = (value: string, targetType: ConfigValueType): any => {
  switch (targetType) {
    case 'number':
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new Error(`Invalid number format for value: '${value}'`);
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
      throw new Error(`Invalid boolean format for value: '${value}'. Expected 'true', 'false', '1', or '0'.`);
    case 'array':
      return value.split(/[,\s]+/).filter(s => s.length > 0);
    case 'json':
      try {
        return JSON.parse(value);
      } catch (e) {
        throw new Error(`Invalid JSON format for value: '${value}'. Error: ${e.message}`);
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
 * @throws Error if a key isn't accepted, or if type coercion fails.
 */
const twakeConfig = (
  desc: ConfigDescription,
  defaultConfigurationFile?: ConfigurationFile,
  useEnv: boolean = false
): Record<string, any> => { // Changed return type from 'object' to 'Record<string, any>'
  let res: { [key: string]: any } = {};

  if (defaultConfigurationFile != null) {
    if (typeof defaultConfigurationFile === 'string') {
      try {
        const fileContent = fs.readFileSync(defaultConfigurationFile).toString();
        res = JSON.parse(fileContent);
      } catch (e) {
        throw new Error(`Failed to read or parse configuration file '${defaultConfigurationFile}': ${e.message}`);
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
      } catch (e) {
        throw new Error(`Configuration error for '${key}' from environment variable '${envVarName}': ${e.message}`);
      }
    } else {
      if (res[key] == null && configProp.default !== undefined) {
        if (typeof configProp.default === 'string' && configProp.type !== 'string') {
          try {
            res[key] = coerceValue(configProp.default, configProp.type);
          } catch (e) {
            throw new Error(`Configuration error for default value of '${key}': ${e.message}`);
          }
        } else {
          res[key] = configProp.default;
        }
      }
    }
  });

  Object.keys(res).forEach((key: string) => {
    if (desc[key] === undefined) {
      throw new Error(`Configuration key '${key}' isn't accepted as it's not defined in the ConfigDescription.`);
    }
  });

  return res;
};

export default twakeConfig;
