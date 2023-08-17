import configParser, { type ConfigDescription } from '@twake/config-parser'
import fs from 'fs'
import { type Format } from 'logform'
import path from 'path'
import { config, createLogger, format, transports, type Logger } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import defaultConfDesc from './config.json'
import {
  EFormatType,
  ELoggerConfigFields,
  ETransportType,
  type Config,
  type FormatConf,
  type LoggerConfig,
  type TransportConf,
  type TransportInstance
} from './types'

export type TwakeLogger = Logger
export { EFormatType, ETransportType, type Config } from './types'

const defaultFileName = 'twake.log'

export const getLogger = (
  conf?: Partial<Config>,
  confDesc?: ConfigDescription
): Logger => {
  if (confDesc == null) confDesc = defaultConfDesc.logging
  if ('logging' in confDesc) confDesc = confDesc.logging as ConfigDescription
  checkLoggerConfig(confDesc, 'Descriptor file')
  const loggingConf = configParser(
    confDesc,
    getConfigurationFile(conf)
  ) as LoggerConfig
  checkLoggerConfig(loggingConf, 'Environment variables')
  return createLogger({
    levels: loggingConf.levels,
    level: loggingConf.logLevel,
    format: getFormatFromConfig(loggingConf.format),
    defaultMeta: loggingConf.defaultMeta,
    transports:
      getTransportsFromEnvVariables(loggingConf) ??
      getTransportsFromConfig(loggingConf.transports),
    silent: loggingConf.silent,
    exitOnError: loggingConf.exitOnError,
    exceptionHandlers: getTransportsFromConfig(loggingConf.exceptionHandlers),
    rejectionHandlers: getTransportsFromConfig(loggingConf.rejectionHandlers)
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
    checkLoggerConfig(res.logging, 'Configuration file')
    return res.logging
  }
  return undefined
}

const getTransportsFromEnvVariables = (
  conf: LoggerConfig
): TransportInstance[] | undefined => {
  if (conf.logger === ETransportType.CONSOLE) {
    return [
      new transports.Console({
        format: format.cli()
      })
    ]
  } else if (conf.logger === ETransportType.FILE) {
    return [
      new transports.File({
        filename: conf.logFile ?? defaultFileName,
        format: format.align()
      })
    ]
  }
}

const getTransportsFromConfig = (
  transportConf: TransportConf[] | null | undefined
): TransportInstance[] => {
  const getTransport = (conf: TransportConf): TransportInstance => {
    let transportFormat: Format | undefined
    if (conf.options?.format != null) {
      transportFormat = getFormatFromConfig(conf.options.format)
    }
    switch (conf.type) {
      case ETransportType.CONSOLE:
      case ETransportType.FILE:
      case ETransportType.HTTP:
        return new transports[conf.type]({
          ...conf.options,
          format: transportFormat
        })
      case ETransportType.DAILY_ROTATE_FILE:
        return new DailyRotateFile({
          ...conf.options,
          format: transportFormat
        })
      case ETransportType.STREAM: {
        const dirname =
          conf.options?.parentDirPath ?? path.join(__dirname, 'logger')
        delete conf.options?.parentDirPath
        fs.mkdirSync(dirname, { recursive: true })
        const filePath = path.join(
          dirname,
          conf.options?.filename ?? defaultFileName
        )
        delete conf.options?.filename
        return new transports.Stream({
          ...conf.options,
          stream: fs.createWriteStream(filePath),
          format: transportFormat
        })
      }
    }
  }

  if (transportConf == null) {
    return []
  }

  return transportConf.map((conf) => getTransport(conf))
}

const getFormatFromConfig = (
  formatConf: FormatConf | FormatConf[] | null | undefined
): Format => {
  const getFormat = (conf: FormatConf): Format => {
    let loggerFormat: Format
    switch (conf.type) {
      case EFormatType.ALIGN:
      case EFormatType.LOGSTASH:
      case EFormatType.SIMPLE:
      case EFormatType.SPLAT:
        loggerFormat = format[conf.type]()
        break
      case EFormatType.CLI:
      case EFormatType.COLORIZE:
      case EFormatType.ERRORS:
      case EFormatType.JSON:
      case EFormatType.LABEL:
      case EFormatType.METADATA:
      case EFormatType.PAD_LEVELS:
      case EFormatType.PRETTY_PRINT:
      case EFormatType.TIMESTAMP:
      case EFormatType.UNCOLORIZE:
        loggerFormat = format[conf.type](conf.options)
        break
      case EFormatType.PRINTF:
        {
          const template = conf.options.template
          const infoLevelRegex = /\$\{info\.level\}/g
          const infoMsgRegex = /\$\{info\.message\}/g
          const infoLvlMatch = infoLevelRegex.exec(template)
          const infoMsgMatch = infoMsgRegex.exec(template)
          if (infoLvlMatch == null || infoMsgMatch == null) {
            throw new Error(
              // eslint-disable-next-line no-template-curly-in-string
              '${info.level} and ${info.message} must be in your template'
            )
          }
          loggerFormat = format.printf((info) => {
            const infoLvl = { match: infoLvlMatch, value: info.level }
            const infoMsg = { match: infoMsgMatch, value: info.message }
            const sortedInfo =
              infoLvlMatch.index < infoMsgMatch.index
                ? [infoLvl, infoMsg]
                : [infoMsg, infoLvl] // check this case
            return `${template.substring(0, sortedInfo[0].match.index)}${String(
              sortedInfo[0].value
            )}${template.substring(
              sortedInfo[0].match.index + sortedInfo[0].match[0].length,
              sortedInfo[1].match.index
            )}${String(sortedInfo[1].value)}${template.substring(
              sortedInfo[1].match.index + sortedInfo[1].match[0].length,
              template.length
            )}`
          })
        }
        break
    }
    return loggerFormat
  }

  if (formatConf == null) {
    return format.simple()
  }

  return Array.isArray(formatConf)
    ? format.combine(...formatConf.map((conf) => getFormat(conf)))
    : getFormat(formatConf)
}

const checkLoggerConfig = (conf: any, filename: string): void => {
  if (typeof conf !== 'object') {
    throw new Error(
      `[${filename}] logging field in error: value must be an object`
    )
  }

  const confKeys = Object.keys(conf)

  const wrongKey = confKeys.find(
    (key) => !Object.values<string>(ELoggerConfigFields).includes(key)
  )
  if (wrongKey != null) {
    throw new Error(
      `[${filename}] logging field in error: ${wrongKey} is not allowed`
    )
  }

  let errorMsg = ''
  confKeys.forEach((key) => {
    try {
      switch (key) {
        case ELoggerConfigFields.DEFAULT_META:
          checkDefaultMetaField(conf[key])
          break
        case ELoggerConfigFields.LOGGER:
          checkLoggerField(conf[key])
          break
        case ELoggerConfigFields.EXIT_ON_ERROR:
        case ELoggerConfigFields.SILENT:
          checkBooleanFields(key, conf[key])
          break
        case ELoggerConfigFields.LOG_FILE:
          checkLogFileField(conf[key], conf[ELoggerConfigFields.LOGGER])
          break
        case ELoggerConfigFields.LEVELS:
          checkLevelsField(conf[key])
          break
        case ELoggerConfigFields.LOG_LEVEL:
          checkLogLevelField(conf[key], conf[ELoggerConfigFields.LEVELS])
          break
        case ELoggerConfigFields.FORMAT:
          checkFormatField(conf[key])
          break
        case ELoggerConfigFields.TRANSPORTS:
        case ELoggerConfigFields.EXCEPTION_HANDLERS:
        case ELoggerConfigFields.REJECTION_HANDLERS:
          checkTransportsArrayField(key, conf[key])
          break
      }
    } catch (e) {
      if (e instanceof Error) {
        errorMsg = errorMsg.concat(e.message, '\n')
      }
    }
  })
  if (errorMsg.length > 0) {
    const prefix = `[${filename}]: \n`
    throw new Error(prefix.concat(errorMsg))
  }
}

const checkDefaultMetaField = (value: any): void => {
  if (value != null && typeof value !== 'object') {
    throw new Error(
      `${ELoggerConfigFields.DEFAULT_META} in error: value must be an object`
    )
  }
}

const checkLoggerField = (value: any): void => {
  if (
    value != null &&
    (typeof value !== 'string' ||
      (value !== ETransportType.CONSOLE && value !== ETransportType.FILE))
  ) {
    throw new Error(
      `${ELoggerConfigFields.LOGGER} in error: value must be equal to "${ETransportType.CONSOLE}" or "${ETransportType.FILE}"`
    )
  }
}

const checkBooleanFields = (key: ELoggerConfigFields, value: any): void => {
  if (value != null && typeof value !== 'boolean') {
    throw new Error(`${key} in error: value must be a boolean`)
  }
}

const checkLogFileField = (value: any, loggerValue: any): void => {
  if (value != null) {
    if (typeof value !== 'string') {
      throw new Error(
        `${ELoggerConfigFields.LOG_FILE} in error: value must be a string`
      )
    } else if (loggerValue !== ETransportType.FILE) {
      throw new Error(
        `${ELoggerConfigFields.LOGGER} in error: value must be equal to "${ETransportType.FILE}"`
      )
    }
  }
}

const checkLevelsField = (value: any): void => {
  if (
    value != null &&
    (typeof value !== 'object' ||
      !Object.entries(value).every(
        ([key, value]) => typeof key === 'string' && typeof value === 'number'
      ))
  ) {
    throw new Error(
      `${ELoggerConfigFields.LEVELS} in error: value must be an objects whose keys must be of type "string" and value of type "number"`
    )
  }
}

const checkLogLevelField = (value: any, levelsValue: any): void => {
  checkLevelsField(levelsValue)

  const isLevelValueOk = (value: string): boolean =>
    Object.keys(levelsValue != null ? levelsValue : config.npm.levels).includes(
      value
    )

  if (value != null && (typeof value !== 'string' || !isLevelValueOk(value))) {
    throw new Error(
      `${ELoggerConfigFields.LOG_LEVEL} in error: value must equal to one of ${ELoggerConfigFields.LEVELS} keys`
    )
  }
}

const checkFormatField = (value: any): void => {
  const checkOptionsField = (element: FormatConf): void => {
    switch (element.type) {
      case EFormatType.ALIGN:
      case EFormatType.LOGSTASH:
      case EFormatType.SIMPLE:
      case EFormatType.SPLAT:
        if ('options' in element) {
          throw new Error(
            `${ELoggerConfigFields.FORMAT} in error: "options" should not be defined for ${element.type} format`
          )
        }
        break
      case EFormatType.PRINTF:
        if (element.options == null || element.options.template == null) {
          throw new Error(
            `${ELoggerConfigFields.FORMAT} in error: "template" in "options" should be defined for "${element.type}" format`
          )
        }
        break
    }
  }

  const checkFormat = (element: any): void => {
    if (element != null) {
      if (
        typeof element !== 'object' ||
        element.type == null ||
        !Object.values(EFormatType).includes(element.type)
      ) {
        throw new Error(
          `${ELoggerConfigFields.FORMAT} in error: value should be an object or an array of objects which have a "type" property whose value must be one of the listed format in documentation`
        )
      }

      checkOptionsField(element)
    }
  }

  Array.isArray(value) ? value.forEach(checkFormat) : checkFormat(value)
}

const checkTransportsArrayField = (
  key: ELoggerConfigFields,
  value: any
): void => {
  const checkTransport = (element: any): void => {
    if (element != null) {
      if (
        typeof element !== 'object' ||
        element.type == null ||
        !Object.values(ETransportType).includes(element.type)
      ) {
        throw new Error(
          `${key} in error: array must contain objects which have a "type" property whose value must be one of the listed transports in documentation`
        )
      } else if (
        element.options != null &&
        typeof element.options !== 'object'
      ) {
        throw new Error(
          `${key} in error: array must contain objects which have an optional "options" property whose value must be an object`
        )
      }
    }
  }

  if (value != null) {
    if (!Array.isArray(value)) {
      throw new Error(`${key} in error: value should be an array of objects`)
    }
    value.map(checkTransport)
  }
}
