export interface Config {
  logging: LoggerConfig
}

export interface LoggerConfig {
  levels?: Record<string, number>
  silent?: boolean
  logLevel?: string
  logFile?: string
  logger?: string
  exitOnError?: boolean
  defaultMeta?: Record<string, any>
}

export enum ELoggerConfigFields {
  DEFAULT_META = 'defaultMeta',
  EXCEPTION_HANDLERS = 'exceptionHandlers',
  EXIT_ON_ERROR = 'exitOnError',
  FORMAT = 'format',
  LEVELS = 'levels',
  LOG_FILE = 'logFile',
  LOG_LEVEL = 'logLevel',
  LOGGER = 'logger',
  REJECTION_HANDLERS = 'rejectionHandlers',
  SILENT = 'silent',
  TRANSPORTS = 'transports'
}
