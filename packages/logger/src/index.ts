/* eslint-disable @typescript-eslint/restrict-template-expressions */
import configParser, { type ConfigDescription } from '@twake-chat/config-parser'
import fs from 'fs'
import path from 'path'
import { createLogger, type Logger } from 'winston'
import defaultConfDesc from './configDesc.json'
import { TwakeLoggerOptions } from './logger-options'
import { type Config, type ILoggerConfig } from './types'

export { ETransportType, type Config } from './types'
export type TwakeLogger = Logger

export const getLogger = (
  conf?: Partial<Config>,
  confDesc?: ConfigDescription
): Logger => {
  confDesc =
    (confDesc?.logging as ConfigDescription) ??
    confDesc ??
    defaultConfDesc.logging
  // Parsing the configuration using the new config parser with using environment variables enabled
  const loggingConf = configParser(
    confDesc,
    getConfigurationFile(conf),
    true,
    false
  )
  return createLogger(
    new TwakeLoggerOptions(loggingConf).convertToWinstonLoggerOptions()
  )
}

const getConfigurationFile = (
  conf: Partial<Config> | undefined
): ILoggerConfig | undefined => {
  let res: any
  const confFilePath = path.join('etc', 'twake', 'logger.conf')
  if (process.env.TWAKE_LOGGER_CONF != null) {
    res = JSON.parse(fs.readFileSync(process.env.TWAKE_LOGGER_CONF).toString())
  } else if (fs.existsSync(confFilePath)) {
    /* istanbul ignore next */
    res = JSON.parse(fs.readFileSync(confFilePath).toString())
  } else if (conf != null) {
    res = conf
  }
  if (res != null) {
    if (typeof res !== 'object') {
      throw new Error('logger configuration in error: conf must be an object')
    } else if ('logging' in res && typeof res.logging !== 'object') {
      throw new Error('logging field in error: value must be an object')
    }
  }
  return res?.logging
}
