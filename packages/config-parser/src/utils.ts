import { type ConfigDescription, type Configuration } from './types'

/**
 * Parses the configuration using the old parser strategy.
 * @param desc - The configuration description.
 * @param res - The resulting configuration.
 */
export const oldParser = (
  desc: ConfigDescription,
  res: Configuration
): void => {
  // Parse wanted keys
  Object.keys(desc).forEach((key: string) => {
    // If environment variable exists, it overrides current value
    if (
      process.env[key.toUpperCase()] != null &&
      process.env[key.toUpperCase()] !== ''
    ) {
      res[key] = process.env[key.toUpperCase()]
    } else {
      // if default value exists use it
      if (res[key] == null && desc[key] != null) {
        res[key] = desc[key]
      }
    }
  })
  // Verify that result as no unwanted keys
  Object.keys(res).forEach((key: string) => {
    if (desc[key] === undefined) {
      throw new Error(`Key ${key} isn't accepted`)
    }
  })
}
