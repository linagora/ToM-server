import {
  nodeFlagsValues,
  type IWriteFileOptions,
  type nodeFlags
} from '../../../types.ts'

export class WriteFileOptions implements IWriteFileOptions {
  private _flags?: nodeFlags
  private _encoding?: string
  private _mode?: number
  private _autoClose?: boolean
  private _emitClose?: boolean
  private _start?: number
  private _highWaterMark?: number
  private _flush?: boolean

  constructor(options: IWriteFileOptions) {
    this.flags = options.flags
    this.encoding = options.encoding
    this.mode = options.mode
    this.autoClose = options.autoClose
    this.emitClose = options.emitClose
    this.start = options.start
    this.highWaterMark = options.highWaterMark
    this.flush = options.flush
  }

  set flags(flags: nodeFlags | undefined) {
    if (flags != null && !nodeFlagsValues.includes(flags)) {
      throw new Error(
        'flags in error: value must be a string and equal to one of the flags supported by Node'
      )
    }
    this._flags = flags
  }

  get flags(): nodeFlags | undefined {
    return this._flags
  }

  set encoding(encoding: string | undefined) {
    if (encoding != null && typeof encoding !== 'string') {
      throw new Error('encoding in error: value must be a string')
    }
    this._encoding = encoding
  }

  get encoding(): string | undefined {
    return this._encoding
  }

  set mode(mode: number | undefined) {
    if (mode != null && typeof mode !== 'number') {
      throw new Error('mode in error: value must be a number')
    }
    this._mode = mode
  }

  get mode(): number | undefined {
    return this._mode
  }

  set autoClose(autoClose: boolean | undefined) {
    if (autoClose != null && typeof autoClose !== 'boolean') {
      throw new Error('autoClose in error: value must be a boolean')
    }
    this._autoClose = autoClose
  }

  get autoClose(): boolean | undefined {
    return this._autoClose
  }

  set emitClose(emitClose: boolean | undefined) {
    if (emitClose != null && typeof emitClose !== 'boolean') {
      throw new Error('emitClose in error: value must be a boolean')
    }
    this._emitClose = emitClose
  }

  get emitClose(): boolean | undefined {
    return this._emitClose
  }

  set start(start: number | undefined) {
    if (start != null && typeof start !== 'number') {
      throw new Error('start in error: value must be a number')
    }
    this._start = start
  }

  get start(): number | undefined {
    return this._start
  }

  set highWaterMark(highWaterMark: number | undefined) {
    if (highWaterMark != null && typeof highWaterMark !== 'number') {
      throw new Error('highWaterMark in error: value must be a number')
    }
    this._highWaterMark = highWaterMark
  }

  get highWaterMark(): number | undefined {
    return this._highWaterMark
  }

  set flush(flush: boolean | undefined) {
    if (flush != null && typeof flush !== 'boolean') {
      throw new Error('flush in error: value must be a boolean')
    }
    this._flush = flush
  }

  get flush(): boolean | undefined {
    return this._flush
  }
}
