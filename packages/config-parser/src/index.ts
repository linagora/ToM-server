import fs from 'fs'

export type ConfigDescription = Record<
  string,
  string | Record<string, any> | number | boolean | null | undefined
>

const twakeConfig = (
  desc: ConfigDescription,
  defaultConfigurationFile?: object | fs.PathOrFileDescriptor
): object => {
  // Use optional configuration file if given
  const res =
    defaultConfigurationFile == null
      ? {}
      : typeof defaultConfigurationFile === 'string'
      ? JSON.parse(fs.readFileSync(defaultConfigurationFile).toString())
      : defaultConfigurationFile
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
  return res
}

export default twakeConfig
