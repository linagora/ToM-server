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
