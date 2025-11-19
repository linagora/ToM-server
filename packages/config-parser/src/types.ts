import fs from 'fs'

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
export interface NewConfigDescription {
  [key: string]: ConfigProperty
}

/**
 * Defines the structure of the old configuration description format.
 * @interface OldConfigDescription
 * @property {Object.<string, string|Object|number|boolean|null|undefined>} [key: string] - A mapping of configuration keys to their respective values, which can be of various types.
 */
export type OldConfigDescription = Record<
  string,
  string | Record<string, any> | number | boolean | null | undefined
>

/**
 * Defines the overall structure of the configuration description.
 * It can be either in the new format (NewConfigDescription) or the old format (OldConfigDescription).
 * @typedef {NewConfigDescription | OldConfigDescription} ConfigDescription
 * @see {NewConfigDescription}
 * @see {OldConfigDescription}
 */
export type ConfigDescription = NewConfigDescription | OldConfigDescription

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
