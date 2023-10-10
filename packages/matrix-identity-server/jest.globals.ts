import { ETransportType, getLogger, type TwakeLogger } from '@twake/logger'
import path from 'path'

const logsDir = path.join(__dirname, 'logs')
const logsFilename = 'identity-server-test.log'

export const logger: TwakeLogger = getLogger({
  logging: {
    transports: [
      {
        type: ETransportType.FILE,
        options: {
          dirname: logsDir,
          filename: logsFilename
        }
      }
    ]
  }
})
