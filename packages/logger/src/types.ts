import type DailyRotateFile from 'winston-daily-rotate-file'
import {
  type ConsoleTransportInstance,
  type FileTransportInstance,
  type HttpTransportInstance,
  type StreamTransportInstance
} from 'winston/lib/winston/transports'

export type TransportInstance =
  | ConsoleTransportInstance
  | FileTransportInstance
  | HttpTransportInstance
  | StreamTransportInstance
  | DailyRotateFile

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
  transports?: TransportConf[]
  exceptionHandlers?: TransportConf[]
  rejectionHandlers?: TransportConf[]
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

// see details on https://github.com/winstonjs/winston/blob/HEAD/docs/transports.md

export type TransportConf =
  | ConsoleTransport
  | FileTransport
  | HttpTransport
  | StreamTransport
  | DailyRotateFileTransport

export enum ETransportType {
  CONSOLE = 'Console',
  FILE = 'File',
  HTTP = 'Http',
  STREAM = 'Stream',
  DAILY_ROTATE_FILE = 'DailyRotateFile'
}

interface ConsoleTransport {
  type: ETransportType.CONSOLE
  options?: ConsoleOptions
}

interface FileTransport {
  type: ETransportType.FILE
  options?: FileOptions
}

interface HttpTransport {
  type: ETransportType.HTTP
  options?: HttpOptions
}

interface StreamTransport {
  type: ETransportType.STREAM
  options?: StreamTransportOptions
}

interface DailyRotateFileTransport {
  type: ETransportType.DAILY_ROTATE_FILE
  options?: DailyRotateFileTransportOptions
}

interface DefaultTransportOptions {
  format?: FormatConf | FormatConf[]
  level?: string
  silent?: boolean
  handleExceptions?: boolean
  handleRejections?: boolean
}

interface ConsoleOptions extends DefaultTransportOptions {
  eol?: string
  stderrLevels?: string[]
  consoleWarnLevels?: string[]
}

interface FileOptions extends DefaultTransportOptions {
  eol?: string
  lazy?: boolean
  dirname?: string
  filename?: string
  maxsize?: number
  maxFiles?: number
  tailable?: boolean
  zippedArchive?: boolean
  options?: WriteFileOptions
}

interface WriteFileOptions {
  flags?: string
  encoding?: string
  mode?: number
  autoClose?: boolean
  emitClose?: boolean
  start?: number
}

interface HttpOptions extends DefaultTransportOptions {
  host?: string
  port?: number
  path?: string
  auth?: AuthCredentials | AuthToken
  ssl?: boolean
  batch?: boolean
  batchInterval?: number
  batchCount?: number
}

interface AuthCredentials {
  username: string
  password: string
}

interface AuthToken {
  bearer: string
}

interface StreamTransportOptions extends DefaultTransportOptions {
  parentDirPath?: string
  filename?: string
  eol?: string
}

interface DailyRotateFileTransportOptions extends DefaultTransportOptions {
  frequency?: string
  datePattern?: string
  zippedArchive?: boolean
  filename?: string
  dirname?: string
  maxSize?: number | string
  maxFiles?: number | string
  options?: WriteFileOptions
  auditFile?: string
  utc?: boolean
  extension?: string
  createSymlink?: boolean
  symlinkName?: string
  auditHashType?: string
}
