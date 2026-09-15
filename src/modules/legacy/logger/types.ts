import { type transports } from 'winston'
import type DailyRotateFile from 'winston-daily-rotate-file'

export type TransportInstance =
  | transports.ConsoleTransportInstance
  | transports.FileTransportInstance
  | DailyRotateFile

export interface Config {
  logging: ILoggerConfig
}

export interface ILoggerConfig {
  silent?: boolean
  log_level?: string
  exit_on_error?: boolean
  default_meta?: Record<string, any>
  log_transports?: string | ITransportConf[]
  exception_handlers?: ITransportConf[]
  rejection_handlers?: ITransportConf[]
}

// see details on https://github.com/winstonjs/winston/blob/HEAD/docs/transports.md

export enum ETransportType {
  CONSOLE = 'Console',
  FILE = 'File',
  DAILY_ROTATE_FILE = 'DailyRotateFile'
}

export type transportType = `${ETransportType}`

export interface TransportConf extends ITransportConf {
  getWinstonTransportInstance: () => TransportInstance
}

export type TransportOptions =
  | IConsoleTransportOptions
  | IFileTransportOptions
  | IDailyRotateFileTransportOptions

export interface ITransportConf {
  type: transportType
  options?: TransportOptions
}

export interface IConsoleTransportConf {
  type: `${ETransportType.CONSOLE}`
  options?: IConsoleTransportOptions
}

export interface IFileTransportConf {
  type: `${ETransportType.FILE}`
  options?: IFileTransportOptions
}

export interface IDailyRotateFileTransportConf {
  type: `${ETransportType.DAILY_ROTATE_FILE}`
  options?: IDailyRotateFileTransportOptions
}

export interface IDefaultTransportOptions {
  level?: string
  silent?: boolean
  handleExceptions?: boolean
  handleRejections?: boolean
}

export interface IConsoleTransportOptions extends IDefaultTransportOptions {
  eol?: string
  stderrLevels?: string[]
  consoleWarnLevels?: string[]
}

export interface IFileTransportOptions extends IDefaultTransportOptions {
  eol?: string
  lazy?: boolean
  dirname?: string
  filename?: string
  maxsize?: number
  maxFiles?: number
  tailable?: boolean
  zippedArchive?: boolean
  options?: IWriteFileOptions
}

export interface IWriteFileOptions {
  flags?: nodeFlags
  encoding?: string
  mode?: number
  autoClose?: boolean
  emitClose?: boolean
  start?: number
  highWaterMark?: number
  flush?: boolean
}

export interface IDailyRotateFileTransportOptions
  extends IDefaultTransportOptions {
  frequency?: string
  datePattern?: string
  zippedArchive?: boolean
  filename?: string
  dirname?: string
  maxSize?: number | string
  maxFiles?: number | string
  options?: IWriteFileOptions
  auditFile?: string
  utc?: boolean
  extension?: string
  createSymlink?: boolean
  symlinkName?: string
  auditHashType?: string
}

export const nodeFlagsValues = [
  'a',
  'ax',
  'a+',
  'ax+',
  'as',
  'as+',
  'r',
  'rs',
  'r+',
  'rs+',
  'w',
  'wx',
  'w+',
  'wx+'
] as const

export type nodeFlags = (typeof nodeFlagsValues)[number]
