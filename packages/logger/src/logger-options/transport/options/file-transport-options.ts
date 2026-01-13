import {
  type IFileTransportOptions,
  type IWriteFileOptions
} from '../../../types.ts'
import { DefaultTransportOptions } from './default-transport-options.ts'
import { WriteFileOptions } from './utils.ts'

const defaultFilename = 'twake.log'

export class FileTransportOptions
  extends DefaultTransportOptions
  implements IFileTransportOptions
{
  private _eol?: string
  private _lazy?: boolean
  private _dirname?: string
  private _filename!: string
  private _maxsize?: number
  private _maxFiles?: number
  private _tailable?: boolean
  private _zippedArchive?: boolean
  private _options?: WriteFileOptions

  constructor(options: IFileTransportOptions = {}) {
    super(options)
    this.eol = options.eol
    this.lazy = options.lazy
    this.dirname = options.dirname
    this.filename = options.filename
    this.maxsize = options.maxsize
    this.maxFiles = options.maxFiles
    this.tailable = options.tailable
    this.zippedArchive = options.zippedArchive
    this.options = options.options
  }

  set eol(eol: string | undefined) {
    if (eol != null && typeof eol !== 'string') {
      throw new Error('eol in error: value must be a string')
    }
    this._eol = eol
  }

  get eol(): string | undefined {
    return this._eol
  }

  set lazy(lazy: boolean | undefined) {
    if (lazy != null && typeof lazy !== 'boolean') {
      throw new Error('lazy in error: value must be a boolean')
    }
    this._lazy = lazy
  }

  get lazy(): boolean | undefined {
    return this._lazy
  }

  set dirname(dirname: string | undefined) {
    if (dirname != null && typeof dirname !== 'string') {
      throw new Error('dirname in error: value must be a string')
    }
    this._dirname = dirname
  }

  get dirname(): string | undefined {
    return this._dirname
  }

  set filename(filename: string | undefined) {
    if (filename != null && typeof filename !== 'string') {
      throw new Error('filename in error: value must be a string')
    }
    this._filename = filename ?? process.env.LOG_FILE ?? defaultFilename
  }

  get filename(): string {
    return this._filename
  }

  set maxsize(maxsize: number | undefined) {
    if (maxsize != null && typeof maxsize !== 'number') {
      throw new Error('maxsize in error: value must be a number')
    }
    this._maxsize = maxsize
  }

  get maxsize(): number | undefined {
    return this._maxsize
  }

  set maxFiles(maxFiles: number | undefined) {
    if (maxFiles != null && typeof maxFiles !== 'number') {
      throw new Error('maxFiles in error: value must be a number')
    }
    this._maxFiles = maxFiles
  }

  get maxFiles(): number | undefined {
    return this._maxFiles
  }

  set tailable(tailable: boolean | undefined) {
    if (tailable != null && typeof tailable !== 'boolean') {
      throw new Error('tailable in error: value must be a boolean')
    }
    this._tailable = tailable
  }

  get tailable(): boolean | undefined {
    return this._tailable
  }

  set zippedArchive(zippedArchive: boolean | undefined) {
    if (zippedArchive != null && typeof zippedArchive !== 'boolean') {
      throw new Error('zippedArchive in error: value must be a boolean')
    }
    this._zippedArchive = zippedArchive
  }

  get zippedArchive(): boolean | undefined {
    return this._zippedArchive
  }

  set options(options: IWriteFileOptions | undefined) {
    if (options != null && typeof options !== 'object') {
      throw new Error('options in error: value must be an object')
    } else if (options != null) {
      try {
        this._options = new WriteFileOptions(options)
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`options.${e.message}`)
      }
    }
  }

  get options(): WriteFileOptions | undefined {
    return this._options
  }
}
