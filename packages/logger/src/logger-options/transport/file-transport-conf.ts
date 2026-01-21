import { transports } from 'winston'
import {
  type ETransportType,
  type IFileTransportConf,
  type IFileTransportOptions,
  type TransportConf
} from '../../types.ts'
import { FileTransportOptions } from './options/file-transport-options.ts'

export class FileTransportConf implements TransportConf {
  public type: `${ETransportType.FILE}`
  private _options?: FileTransportOptions

  constructor(conf: IFileTransportConf) {
    this.type = conf.type
    this.options = conf.options
  }

  set options(options: IFileTransportOptions | undefined) {
    if (options != null && typeof options !== 'object') {
      throw new Error('options in error: value must be an object')
    }
    try {
      this._options = new FileTransportOptions(options)
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`options.${e.message}`)
    }
  }

  get options(): FileTransportOptions | undefined {
    return this._options
  }

  getWinstonTransportInstance(): transports.FileTransportInstance {
    return new transports.File(this.options)
  }
}
