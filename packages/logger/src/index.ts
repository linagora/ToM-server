import configParser, { type ConfigDescription } from '@twake/config-parser'
import fs from 'fs'
import path from 'path'
import { createLogger, type Logger } from 'winston'
import defaultConfDesc from './config.json'
import {
  type Config,
  type LoggerConfig,
} from './types'

export const getLogger = (
  conf?: Partial<Config>,
  confDesc?: ConfigDescription
): Logger => {
  if (confDesc == null) confDesc = defaultConfDesc.logging
  if ('logging' in confDesc) confDesc = confDesc.logging as ConfigDescription
  const loggingConf = configParser(
    confDesc,
    getConfigurationFile(conf)
  ) as LoggerConfig
  return createLogger({
    levels: loggingConf.levels,
    level: loggingConf.logLevel,
    defaultMeta: loggingConf.defaultMeta,
    silent: loggingConf.silent,
    exitOnError: loggingConf.exitOnError,
  })
}

const getConfigurationFile = (
  conf: Partial<Config> | undefined
): LoggerConfig | undefined => {
  let res: any
  const confFilePath = path.join('etc', 'twake', 'logger.conf')
  /* istanbul ignore else */
  if (conf != null) {
    res = conf
  } else if (process.env.TWAKE_LOGGER_CONF != null) {
    res = JSON.parse(fs.readFileSync(process.env.TWAKE_LOGGER_CONF).toString())
  } else if (fs.existsSync(confFilePath)) {
    res = JSON.parse(fs.readFileSync(confFilePath).toString())
  } else {
    return undefined
  }
  if (res.logging != null) {
    return res.logging
  }
  return undefined
}
