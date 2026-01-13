import { transports } from 'winston'
import {
  type ETransportType,
  type IConsoleTransportConf,
  type IConsoleTransportOptions,
  type TransportConf
} from '../../types.ts'
import { ConsoleTransportOptions } from './options/console-transport-options.ts'

export class ConsoleTransportConf implements TransportConf {
  public type: `${ETransportType.CONSOLE}`
  private _options?: ConsoleTransportOptions

  constructor(conf: IConsoleTransportConf) {
    this.type = conf.type
    this.options = conf.options
  }

  set options(options: IConsoleTransportOptions | undefined) {
    if (options != null && typeof options !== 'object') {
      throw new Error('options in error: value must be an object')
    } else if (options != null) {
      try {
        this._options = new ConsoleTransportOptions(options)
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`options.${e.message}`)
      }
    }
  }

  get options(): ConsoleTransportOptions | undefined {
    return this._options
  }

  getWinstonTransportInstance(): transports.ConsoleTransportInstance {
    return new transports.Console(this.options)
  }
}
