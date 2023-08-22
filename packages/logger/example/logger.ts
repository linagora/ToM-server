import { EFormatType, ETransportType, getLogger } from '@twake/logger'

const logger = getLogger({
  logging: {
    logLevel: 'error',
    format: {
      type: EFormatType.CLI
    },
    transports: [
      {
        type: ETransportType.FILE,
        options: {
          dirname: 'etc/twake/logs',
          filename: 'twake.log'
        }
      }
    ]
  }
})

logger.info('info message') // won't be written in twake.log file
logger.error('error message') // will be written in twake.log file
