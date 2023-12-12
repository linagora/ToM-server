import {
  type IDailyRotateFileTransportOptions,
  type IWriteFileOptions
} from '../../../types'
import { DefaultTransportOptions } from './default-transport-options'
import { WriteFileOptions } from './utils'

const defaultRotateFilename = 'twake-%DATE%.log'

export class DailyRotateFileTransportOptions
  extends DefaultTransportOptions
  implements IDailyRotateFileTransportOptions
{
  private _frequency?: string
  private _datePattern?: string
  private _zippedArchive?: boolean
  private _filename!: string
  private _dirname?: string
  private _maxSize?: number | string
  private _maxFiles?: number | string
  private _options?: WriteFileOptions
  private _auditFile?: string
  private _utc?: boolean
  private _extension?: string
  private _createSymlink?: boolean
  private _symlinkName?: string
  private _auditHashType?: string

  constructor(options: IDailyRotateFileTransportOptions = {}) {
    super(options)
    this.frequency = options.frequency
    this.datePattern = options.datePattern
    this.zippedArchive = options.zippedArchive
    this.filename = options.filename
    this.dirname = options.dirname
    this.maxSize = options.maxSize
    this.maxFiles = options.maxFiles
    this.options = options.options
    this.auditFile = options.auditFile
    this.utc = options.utc
    this.extension = options.extension
    this.createSymlink = options.createSymlink
    this.symlinkName = options.symlinkName
    this.auditHashType = options.auditHashType
  }

  set frequency(frequency: string | undefined) {
    if (
      frequency != null &&
      !(
        typeof frequency === 'string' &&
        frequency.match(/^[1-9]+[0-9]*[mh]$/g) != null
      )
    ) {
      throw new Error(
        'frequency in error: value must be a string which follows pattern <integer> with "m" or "h" as suffix'
      )
    }
    this._frequency = frequency
  }

  get frequency(): string | undefined {
    return this._frequency
  }

  set datePattern(datePattern: string | undefined) {
    if (datePattern != null && typeof datePattern !== 'string') {
      throw new Error(
        'datePattern in error: value must be a string which represents a format supported by moment.js library'
      )
    }
    this._datePattern = datePattern
  }

  get datePattern(): string | undefined {
    return this._datePattern
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
    this._filename = filename ?? defaultRotateFilename
  }

  get filename(): string {
    return this._filename
  }

  set maxSize(maxSize: number | string | undefined) {
    if (
      maxSize != null &&
      !(
        typeof maxSize === 'string' &&
        maxSize.match(/^[1-9]+[0-9]*[kmg]$/g) != null
      ) &&
      typeof maxSize !== 'number'
    ) {
      throw new Error(
        'maxSize in error: value must be a number or a string which follows pattern <integer> with "k", "m" or "g" as suffix'
      )
    }

    this._maxSize = maxSize
  }

  get maxSize(): number | string | undefined {
    return this._maxSize
  }

  set maxFiles(maxFiles: number | string | undefined) {
    if (
      maxFiles != null &&
      !(
        typeof maxFiles === 'string' &&
        maxFiles.match(/^[1-9]+[0-9]*d$/g) != null
      ) &&
      typeof maxFiles !== 'number'
    ) {
      throw new Error(
        'maxFiles in error: value must be a number or a string which follows pattern <integer> with "d" as suffix'
      )
    }
    this._maxFiles = maxFiles
  }

  get maxFiles(): number | string | undefined {
    return this._maxFiles
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

  set auditFile(auditFile: string | undefined) {
    if (auditFile != null && typeof auditFile !== 'string') {
      throw new Error('auditFile in error: value must be a string')
    }
    this._auditFile = auditFile
  }

  get auditFile(): string | undefined {
    return this._auditFile
  }

  set utc(utc: boolean | undefined) {
    if (utc != null && typeof utc !== 'boolean') {
      throw new Error('utc in error: value must be a boolean')
    }
    this._utc = utc
  }

  get utc(): boolean | undefined {
    return this._utc
  }

  set extension(extension: string | undefined) {
    if (extension != null && typeof extension !== 'string') {
      throw new Error('extension in error: value must be a string')
    }
    this._extension = extension
  }

  get extension(): string | undefined {
    return this._extension
  }

  set createSymlink(createSymlink: boolean | undefined) {
    if (createSymlink != null && typeof createSymlink !== 'boolean') {
      throw new Error('createSymlink in error: value must be a boolean')
    }
    this._createSymlink = createSymlink
  }

  get createSymlink(): boolean | undefined {
    return this._createSymlink
  }

  set symlinkName(symlinkName: string | undefined) {
    if (symlinkName != null && typeof symlinkName !== 'string') {
      throw new Error('symlinkName in error: value must be a string')
    }
    this._symlinkName = symlinkName
  }

  get symlinkName(): string | undefined {
    return this._symlinkName
  }

  set auditHashType(auditHashType: string | undefined) {
    if (auditHashType != null && typeof auditHashType !== 'string') {
      throw new Error('auditHashType in error: value must be a string')
    }
    this._auditHashType = auditHashType
  }

  get auditHashType(): string | undefined {
    return this._auditHashType
  }
}
