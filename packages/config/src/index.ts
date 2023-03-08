import fs from 'fs'

type ConfigDescription = Record<string, string | number | boolean | null | undefined>

const twakeConfig = (desc: ConfigDescription, defaultConfigurationFile?: fs.PathOrFileDescriptor): object => {
  const res =
    defaultConfigurationFile != null
      ? JSON.parse(fs.readFileSync(defaultConfigurationFile).toString()) 
      : {}
  Object.keys(desc).forEach((key: string) => {
    if (process.env[key.toUpperCase()] != null) {
      res[key] = process.env[key.toUpperCase()]
    } else {
      if (res[key] == null && desc[key] != null) {
        res[key] = desc[key]
      }
    }
  })
  return res
}

export default twakeConfig
