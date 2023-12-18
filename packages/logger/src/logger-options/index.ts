import { config, format, type LoggerOptions } from 'winston'
import {
  ETransportType,
  type ILoggerConfig,
  type ITransportConf,
  type TransportConf
} from '../types'
import { createTransportConf } from './transport'

export class TwakeLoggerOptions {
  private _logLevel?: string
  private _silent?: boolean
  private _exitOnError?: boolean
  private _defaultMeta?: Record<string, any>
  private _logTransports!: TransportConf[]
  private _exceptionHandlers!: TransportConf[]
  private _rejectionHandlers!: TransportConf[]

  constructor(conf: ILoggerConfig) {
    this.logLevel = conf.log_level
    this.silent = conf.silent
    this.logTransports = conf.log_transports
    this.exitOnError = conf.exit_on_error
    this.defaultMeta = conf.default_meta
    this.exceptionHandlers = conf.exception_handlers
    this.rejectionHandlers = conf.rejection_handlers
  }

  set logLevel(logLevel: string | undefined) {
    if (
      logLevel != null &&
      (typeof logLevel !== 'string' ||
        !Object.keys(config.npm.levels).includes(logLevel))
    ) {
      throw new Error(
        'log_level in error: value must equal to one of default npm levels'
      )
    }
    this._logLevel = logLevel
  }

  get logLevel(): string | undefined {
    return this._logLevel
  }

  set silent(silent: boolean | undefined) {
    if (silent != null && typeof silent !== 'boolean') {
      throw new Error('silent in error: value must be a boolean')
    }
    this._silent = silent
  }

  get silent(): boolean | undefined {
    return this._silent
  }

  set exitOnError(exitOnError: boolean | undefined) {
    if (exitOnError != null && typeof exitOnError !== 'boolean') {
      throw new Error('exit_on_error in error: value must be a boolean')
    }
    this._exitOnError = exitOnError
  }

  get exitOnError(): boolean | undefined {
    return this._exitOnError
  }

  set defaultMeta(defaultMeta: Record<string, any> | undefined) {
    if (defaultMeta != null && typeof defaultMeta !== 'object') {
      throw new Error('default_meta in error: value must be an object')
    }
    this._defaultMeta = defaultMeta
  }

  get defaultMeta(): Record<string, any> | undefined {
    return this._defaultMeta
  }

  set logTransports(logTransports: string | ITransportConf[] | undefined) {
    try {
      this._logTransports = TwakeLoggerOptions.convertToITransportConf(
        logTransports,
        true
      ).map((conf) => createTransportConf(conf))
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`log_transports.${e.message}`)
    }
  }

  get logTransports(): TransportConf[] {
    return this._logTransports
  }

  set exceptionHandlers(
    exceptionHandlers: string | ITransportConf[] | undefined
  ) {
    try {
      this._exceptionHandlers = TwakeLoggerOptions.convertToITransportConf(
        exceptionHandlers
      ).map((conf) => createTransportConf(conf))
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`exception_handlers.${e.message}`)
    }
  }

  get exceptionHandlers(): TransportConf[] | undefined {
    return this._exceptionHandlers
  }

  set rejectionHandlers(
    rejectionHandlers: string | ITransportConf[] | undefined
  ) {
    try {
      this._rejectionHandlers = TwakeLoggerOptions.convertToITransportConf(
        rejectionHandlers
      ).map((conf) => createTransportConf(conf))
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`rejection_handlers.${e.message}`)
    }
  }

  get rejectionHandlers(): TransportConf[] | undefined {
    return this._rejectionHandlers
  }

  convertToWinstonLoggerOptions(): LoggerOptions {
    return {
      level: this.logLevel,
      format: format.printf((info) => {
        const separator = ' | '
        const message = `${info.level.toUpperCase()}${separator}${new Date().toISOString()}${separator}`
        const requestDetails = (...values: Array<string | number>): string => {
          const details = values
            .filter((value) => value != null)
            .join(separator)
          return details.length > 0 ? details.concat(separator) : details
        }

        const loggerInfoDefaultKeys = ['level', 'message']

        const requestDetailsKeys = [
          'ip',
          'matrixUserId',
          'httpMethod',
          'requestUrl',
          'endpointPath',
          'status'
        ]

        const additionnalDetails = (): string => {
          const details = Object.keys(info)
            .filter(
              (key) =>
                !loggerInfoDefaultKeys.includes(key) &&
                !requestDetailsKeys.includes(key)
            )
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            .map((key) => `${key.toLocaleUpperCase()}: ${info[key]}`)
            .join(separator)
          return details.length > 0 ? separator.concat(details) : details
        }

        return message.concat(
          requestDetails(
            info.ip,
            info.matrixUserId,
            info.httpMethod,
            info.requestUrl,
            info.endpointPath,
            info.status
          ),
          info.message,
          additionnalDetails()
        )
      }),
      defaultMeta: this.defaultMeta,
      transports: this.logTransports?.map((transport) =>
        transport.getWinstonTransportInstance()
      ),
      silent: this.silent,
      exitOnError: this.exitOnError,
      exceptionHandlers: this.exceptionHandlers?.map((transport) =>
        transport.getWinstonTransportInstance()
      ),
      rejectionHandlers: this.rejectionHandlers?.map((transport) =>
        transport.getWinstonTransportInstance()
      )
    }
  }

  private static convertToITransportConf(
    confValue: string | ITransportConf[] | undefined,
    getDefaultTransport = false
  ): Array<{ type: string }> | ITransportConf[] {
    const defaultTransport = [{ type: ETransportType.CONSOLE }]
    if (typeof confValue === 'string') {
      return confValue.split(',').map((type) => ({ type }))
    } else if (Array.isArray(confValue)) {
      return confValue
    } else if (getDefaultTransport) {
      return defaultTransport
    } else {
      return []
    }
  }
}
