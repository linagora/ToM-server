import {
  ETransportType,
  type ITransportConf,
  type TransportConf
} from '../../types.ts'
import { ConsoleTransportConf } from './console-transport-conf.ts'
import { DailyRotateFileTransportConf } from './daily-rotate-transport-conf.ts'
import { FileTransportConf } from './file-transport-conf.ts'

export const createTransportConf = (
  conf: ITransportConf | { type: string }
): TransportConf => {
  switch (conf.type) {
    case ETransportType.CONSOLE:
      return new ConsoleTransportConf({
        ...conf,
        type: conf.type as ETransportType.CONSOLE
      })
    case ETransportType.DAILY_ROTATE_FILE:
      return new DailyRotateFileTransportConf({
        ...conf,
        type: conf.type as ETransportType.DAILY_ROTATE_FILE
      })
    case ETransportType.FILE:
      return new FileTransportConf({
        options: 'options' in conf ? (conf.options as any) : undefined, // type assertion due to maxFiles property
        type: conf.type as ETransportType.FILE
      })
    default:
      throw new Error(
        'type in error: value must be one of the listed transports in documentation'
      )
  }
}
