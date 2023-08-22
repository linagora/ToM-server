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
  format?: FormatConf | FormatConf[]
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

// see details on https://github.com/winstonjs/logform/blob/master/README.md

export type FormatConf =
  | Align
  | CLI
  | Colorize
  | Errors
  | JSON
  | Label
  | Logstash
  | Metadata
  | PadLevels
  | PrettyPrint
  | Printf
  | Simple
  | Splat
  | Timestamp
  | Uncolorize

export enum EFormatType {
  ALIGN = 'align',
  CLI = 'cli',
  COLORIZE = 'colorize',
  ERRORS = 'errors',
  JSON = 'json',
  LABEL = 'label',
  LOGSTASH = 'logstash',
  METADATA = 'metadata',
  PAD_LEVELS = 'padLevels',
  PRETTY_PRINT = 'prettyPrint',
  PRINTF = 'printf',
  SIMPLE = 'simple',
  SPLAT = 'splat',
  TIMESTAMP = 'timestamp',
  UNCOLORIZE = 'uncolorize'
}

interface Align {
  type: EFormatType.ALIGN
}

interface CLI {
  type: EFormatType.CLI
  options?: ColorizeOptions & PadLevelsOptions
}

interface Colorize {
  type: EFormatType.COLORIZE
  options?: ColorizeOptions
}

interface Errors {
  type: EFormatType.ERRORS
  options?: ErrorsOptions
}

interface JSON {
  type: EFormatType.JSON
  options?: JSONOptions
}

interface Label {
  type: EFormatType.LABEL
  options?: LabelOptions
}

interface Logstash {
  type: EFormatType.LOGSTASH
}

interface Metadata {
  type: EFormatType.METADATA
  options?: MetadataOptions
}

interface PadLevels {
  type: EFormatType.PAD_LEVELS
  options?: PadLevelsOptions
}

interface PrettyPrint {
  type: EFormatType.PRETTY_PRINT
  options?: PrettyPrintOptions
}

interface Printf {
  type: EFormatType.PRINTF
  options: PrintfOptions
}

interface Simple {
  type: EFormatType.SIMPLE
}

interface Splat {
  type: EFormatType.SPLAT
}

interface Timestamp {
  type: EFormatType.TIMESTAMP
  options?: TimestampOptions
}

interface Uncolorize {
  type: EFormatType.UNCOLORIZE
  options?: UncolorizeOptions
}

interface ColorizeOptions {
  level?: boolean
  all?: boolean
  message?: boolean
  colors?: Record<string, string>
}

interface ErrorsOptions {
  stack?: boolean
}

interface JSONOptions {
  space?: number
}

interface LabelOptions {
  label?: string
  message?: boolean
}

interface MetadataOptions {
  key?: string
  fillExcept?: string[]
  fillWith?: string[]
}

interface PadLevelsOptions {
  levels?: Record<string, number>
  filler?: string
}

interface PrettyPrintOptions {
  depth?: number
  colorize?: boolean
}

interface PrintfOptions {
  template: string
}

interface TimestampOptions {
  format?: string
  alias?: string
}

interface UncolorizeOptions {
  level?: boolean
  message?: boolean
  raw?: boolean
}
