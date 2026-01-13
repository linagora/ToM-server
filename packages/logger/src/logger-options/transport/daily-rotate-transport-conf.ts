import DailyRotateFile from 'winston-daily-rotate-file'
import {
  type ETransportType,
  type IDailyRotateFileTransportConf,
  type IDailyRotateFileTransportOptions,
  type TransportConf
} from '../../types.ts'
import { DailyRotateFileTransportOptions } from './options/daily-rotate-file-transport-options.ts'

export class DailyRotateFileTransportConf implements TransportConf {
  public type: `${ETransportType.DAILY_ROTATE_FILE}`
  private _options?: DailyRotateFileTransportOptions

  constructor(conf: IDailyRotateFileTransportConf) {
    this.type = conf.type
    this.options = conf.options
  }

  set options(options: IDailyRotateFileTransportOptions | undefined) {
    if (options != null && typeof options !== 'object') {
      throw new Error('options in error: value must be an object')
    }
    try {
      this._options = new DailyRotateFileTransportOptions(options)
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`options.${e.message}`)
    }
  }

  get options(): DailyRotateFileTransportOptions | undefined {
    return this._options
  }

  getWinstonTransportInstance(): DailyRotateFile {
    return new DailyRotateFile(this.options)
  }
}
