import { config } from 'winston'
import { type IDefaultTransportOptions } from '../../../types'

export abstract class DefaultTransportOptions
  implements IDefaultTransportOptions
{
  private _level?: string
  private _silent?: boolean
  private _handleExceptions?: boolean
  private _handleRejections?: boolean

  constructor(options: Record<string, any>) {
    this.level = options.level
    this.silent = options.silent
    this.handleExceptions = options.handleExceptions
    this.handleRejections = options.handleRejections
  }

  set level(level: string | undefined) {
    if (
      level != null &&
      (typeof level !== 'string' ||
        !Object.keys(config.npm.levels).includes(level))
    ) {
      throw new Error(
        'level in error: value must equal to one of default npm levels'
      )
    }
    this._level = level
  }

  get level(): string | undefined {
    return this._level
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

  set handleExceptions(handleExceptions: boolean | undefined) {
    if (handleExceptions != null && typeof handleExceptions !== 'boolean') {
      throw new Error('handleExceptions in error: value must be a boolean')
    }
    this._handleExceptions = handleExceptions
  }

  get handleExceptions(): boolean | undefined {
    return this._handleExceptions
  }

  set handleRejections(handleRejections: boolean | undefined) {
    if (handleRejections != null && typeof handleRejections !== 'boolean') {
      throw new Error('handleRejections in error: value must be a boolean')
    }
    this._handleRejections = handleRejections
  }

  get handleRejections(): boolean | undefined {
    return this._handleRejections
  }
}
