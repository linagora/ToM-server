import fs from 'fs'
import moment from 'moment'
import path from 'path'
import winston from 'winston'
import * as loggerModule from '.'
import JEST_PROCESS_ROOT_PATH from '../jest.globals'
import defaultConfDesc from './config.json'
import { EFormatType, ETransportType, type TransportInstance } from './types'

describe('Logger', () => {
  process.setMaxListeners(12)
  test('should create console logger based on environment variables', () => {
    const createLoggerSpy = jest
      .spyOn(winston, 'createLogger')
      .mockImplementation() // default createLogger implementation updates parameter fields so we have to mock if we want the following expect to work
    process.env.LOGGER = 'Console'
    process.env.LOGLEVEL = 'warn'
    loggerModule.getLogger()
    expect(createLoggerSpy).toHaveBeenCalledWith({
      levels: undefined,
      level: 'warn',
      format: winston.format.simple(), // cli format is defined in transport
      defaultMeta: undefined,
      transports: expect.anything(),
      silent: false,
      exitOnError: true,
      exceptionHandlers: [],
      rejectionHandlers: []
    })
    const transportsField = createLoggerSpy.mock.calls[0][0]
      ?.transports as TransportInstance[]
    expect(transportsField).toHaveLength(1)
    expect(transportsField[0]).toBeInstanceOf(winston.transports.Console)
    createLoggerSpy.mockRestore()
    const logger = loggerModule.getLogger()
    expect(logger).toBeDefined()
    delete process.env.LOGGER
    delete process.env.LOGLEVEL
  })

  test('should create file logger based on environment variables', (done) => {
    const createLoggerSpy = jest
      .spyOn(winston, 'createLogger')
      .mockImplementation()
    process.env.LOGGER = 'File'
    process.env.LOGLEVEL = 'warn'
    process.env.LOGFILE = 'test-logs.txt'
    const logFilePath = path.join(JEST_PROCESS_ROOT_PATH, process.env.LOGFILE)
    loggerModule.getLogger()
    expect(createLoggerSpy).toHaveBeenCalledWith({
      levels: undefined,
      level: 'warn',
      format: winston.format.simple(),
      defaultMeta: undefined,
      transports: expect.anything(),
      silent: false,
      exitOnError: true,
      exceptionHandlers: [],
      rejectionHandlers: []
    })
    const transportsField = createLoggerSpy.mock.calls[0][0]
      ?.transports as TransportInstance[]
    expect(transportsField).toHaveLength(1)
    expect(transportsField[0]).toBeInstanceOf(winston.transports.File)
    createLoggerSpy.mockRestore()
    const logger = loggerModule.getLogger()
    expect(logger).toBeDefined()
    setTimeout(() => {
      expect(fs.existsSync(logFilePath)).toEqual(true)
      fs.unlinkSync(logFilePath)
      delete process.env.LOGGER
      delete process.env.LOGLEVEL
      delete process.env.LOGFILE
      done()
    }, 1000)
  })

  test('should throw an error if an environment variable is not correctly defined', () => {
    process.env.LOGGER = 'Console'
    process.env.LOGLEVEL = 'warn'
    process.env.FORMAT = 'falsy'
    expect(() => loggerModule.getLogger()).toThrowError(
      '[Environment variables]: \nformat in error: value should be an object or an array of objects which have a "type" property whose value must be one of the listed format in documentation'
    )
    delete process.env.LOGGER
    delete process.env.LOGLEVEL
    delete process.env.FORMAT
  })

  test('should create file logger based on environment variables with default filename', (done) => {
    const createLoggerSpy = jest
      .spyOn(winston, 'createLogger')
      .mockImplementation()
    process.env.LOGGER = 'File'
    process.env.LOGLEVEL = 'warn'
    const logFilePath = path.join(JEST_PROCESS_ROOT_PATH, 'twake.log')
    loggerModule.getLogger()
    expect(createLoggerSpy).toHaveBeenCalledWith({
      levels: undefined,
      level: 'warn',
      format: winston.format.simple(),
      defaultMeta: undefined,
      transports: expect.anything(),
      silent: false,
      exitOnError: true,
      exceptionHandlers: [],
      rejectionHandlers: []
    })
    const transportsField = createLoggerSpy.mock.calls[0][0]
      ?.transports as TransportInstance[]
    expect(transportsField).toHaveLength(1)
    expect(transportsField[0]).toBeInstanceOf(winston.transports.File)
    createLoggerSpy.mockRestore()
    const logger = loggerModule.getLogger()
    expect(logger).toBeDefined()
    setTimeout(() => {
      expect(fs.existsSync(logFilePath)).toEqual(true)
      fs.unlinkSync(logFilePath)
      delete process.env.LOGGER
      delete process.env.LOGLEVEL
      done()
    }, 1000)
  })

  test('should create console logger based on config.json file', () => {
    process.env.TWAKE_LOGGER_CONF = path.join(
      JEST_PROCESS_ROOT_PATH,
      'src',
      '__testData__',
      'console-config.json'
    )
    const createLoggerSpy = jest
      .spyOn(winston, 'createLogger')
      .mockImplementation()
    loggerModule.getLogger()
    expect(createLoggerSpy).toHaveBeenCalledWith({
      levels: undefined,
      level: 'warn',
      format: winston.format.cli(),
      defaultMeta: undefined,
      transports: expect.anything(),
      silent: false,
      exitOnError: true,
      exceptionHandlers: [],
      rejectionHandlers: []
    })
    const transportsField = createLoggerSpy.mock.calls[0][0]
      ?.transports as TransportInstance[]
    expect(transportsField).toHaveLength(1)
    expect(transportsField[0]).toBeInstanceOf(winston.transports.Console)
    createLoggerSpy.mockRestore()
    const logger = loggerModule.getLogger()
    expect(logger).toBeDefined()
    delete process.env.TWAKE_LOGGER_CONF
  })

  test('should create stream logger based on config object', (done) => {
    const rootDirPath = path.join(JEST_PROCESS_ROOT_PATH, 'stream-logs')
    const conf = {
      logging: {
        logLevel: 'error',
        format: {
          type: EFormatType.ALIGN as const
        },
        transports: [
          {
            type: ETransportType.STREAM as const,
            options: {
              parentDirPath: path.join(rootDirPath, 'logger'),
              filename: 'logs.txt'
            }
          }
        ]
      }
    }

    const logFile = path.join(
      JEST_PROCESS_ROOT_PATH,
      'stream-logs',
      'logger',
      'logs.txt'
    )
    const createLoggerSpy = jest
      .spyOn(winston, 'createLogger')
      .mockImplementation()
    loggerModule.getLogger(conf)
    expect(createLoggerSpy).toHaveBeenCalledWith({
      levels: undefined,
      level: 'error',
      format: winston.format.align(),
      defaultMeta: undefined,
      transports: expect.anything(),
      silent: false,
      exitOnError: true,
      exceptionHandlers: [],
      rejectionHandlers: []
    })
    const transportsField = createLoggerSpy.mock.calls[0][0]
      ?.transports as TransportInstance[]
    expect(transportsField).toHaveLength(1)
    expect(transportsField[0]).toBeInstanceOf(winston.transports.Stream)
    createLoggerSpy.mockRestore()
    const logger = loggerModule.getLogger()
    expect(logger).toBeDefined()
    setTimeout(() => {
      expect(fs.existsSync(logFile)).toEqual(true)
      fs.rmSync(rootDirPath, { recursive: true })
      done()
    }, 1000)
  })

  test('should create stream logger based on default values for parentDirPath and filename', (done) => {
    const rootDirPath = path.join(JEST_PROCESS_ROOT_PATH, 'src', 'logger')
    const conf = {
      logging: {
        logLevel: 'error',
        format: {
          type: EFormatType.ALIGN as const
        },
        transports: [
          {
            type: ETransportType.STREAM as const
          }
        ]
      }
    }

    const logFile = path.join(rootDirPath, 'twake.log')
    const createLoggerSpy = jest
      .spyOn(winston, 'createLogger')
      .mockImplementation()
    loggerModule.getLogger(conf)
    expect(createLoggerSpy).toHaveBeenCalledWith({
      levels: undefined,
      level: 'error',
      format: winston.format.align(),
      defaultMeta: undefined,
      transports: expect.anything(),
      silent: false,
      exitOnError: true,
      exceptionHandlers: [],
      rejectionHandlers: []
    })
    const transportsField = createLoggerSpy.mock.calls[0][0]
      ?.transports as TransportInstance[]
    expect(transportsField).toHaveLength(1)
    expect(transportsField[0]).toBeInstanceOf(winston.transports.Stream)
    createLoggerSpy.mockRestore()
    const logger = loggerModule.getLogger()
    expect(logger).toBeDefined()
    setTimeout(() => {
      expect(fs.existsSync(logFile)).toEqual(true)
      fs.rmSync(rootDirPath, { recursive: true })
      done()
    }, 1000)
  })

  test('should create a file logger if an empty transports array is provided', () => {
    process.env.TWAKE_LOGGER_CONF = path.join(
      JEST_PROCESS_ROOT_PATH,
      'src',
      '__testData__',
      'falsy-transport-config.json'
    )
    expect(() => loggerModule.getLogger()).toThrowError(
      'transports in error: array must contain objects which have a "type" property whose value must be one of the listed transports in documentation'
    )
    delete process.env.TWAKE_LOGGER_CONF
  })

  test('should create a file logger with a custom template', (done) => {
    const conf = {
      logging: {
        logLevel: 'error',
        format: {
          type: EFormatType.PRINTF as const,
          options: {
            template:
              // eslint-disable-next-line no-template-curly-in-string
              'This is the level ${info.level} for the log ${info.message}'
          }
        },
        transports: [
          {
            type: ETransportType.FILE as const,
            options: {
              filename: 'logs.txt'
            }
          }
        ]
      }
    }

    const logFile = path.join(JEST_PROCESS_ROOT_PATH, 'logs.txt')
    const logger = loggerModule.getLogger(conf)
    expect(logger).toBeDefined()
    logger.error('test message')
    setTimeout(() => {
      expect(fs.existsSync(logFile)).toEqual(true)
      const data = fs.readFileSync(logFile, 'utf8')
      expect(data).toEqual('This is the level error for the log test message\n')
      fs.unlinkSync(logFile)
      done()
    }, 100)
  })

  test('should create a file logger with a custom template where message is before level', (done) => {
    const conf = {
      logging: {
        logLevel: 'error',
        format: {
          type: EFormatType.PRINTF as const,
          options: {
            template:
              // eslint-disable-next-line no-template-curly-in-string
              'This is the log ${info.message} with the level ${info.level}'
          }
        },
        transports: [
          {
            type: ETransportType.FILE as const,
            options: {
              filename: 'logs.txt'
            }
          }
        ]
      }
    }

    const logFile = path.join(JEST_PROCESS_ROOT_PATH, 'logs.txt')
    const logger = loggerModule.getLogger(conf)
    expect(logger).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    logger.on('finish', async () => {
      const logFileCreated = async (logFilePath: string): Promise<void> => {
        let timer: NodeJS.Timeout | null = null
        await new Promise<void>((resolve, reject) => {
          timer = setInterval(() => {
            try {
              if (fs.existsSync(logFilePath)) {
                resolve()
              }
            } catch (e) {
              reject(e)
            }
          }, 1000)
        })
        if (timer != null) clearInterval(timer)
      }

      await logFileCreated(logFile)
      expect(fs.existsSync(logFile)).toEqual(true)
      const data = fs.readFileSync(logFile, 'utf8')
      expect(data).toEqual(
        'This is the log test message with the level error\n'
      )
      fs.unlinkSync(logFile)
      done()
    })
    logger.error('test message')
    logger.end()
  })

  // eslint-disable-next-line no-template-curly-in-string
  test('should throw an error if custom template does not contain ${info.message}', () => {
    const conf = {
      logging: {
        logLevel: 'error',
        format: {
          type: EFormatType.PRINTF as const,
          options: {
            template:
              // eslint-disable-next-line no-template-curly-in-string
              'This is the level ${info.level} and there is no message'
          }
        }
      }
    }

    expect(() => loggerModule.getLogger(conf)).toThrowError(
      // eslint-disable-next-line no-template-curly-in-string
      '${info.level} and ${info.message} must be in your template'
    )
  })

  test('should create a logger even if transports field is null', () => {
    const conf = {
      logging: {
        logLevel: 'error'
      }
    }
    const defaultConf = {
      logging: { ...defaultConfDesc.logging, transports: null }
    }
    const createLoggerSpy = jest
      .spyOn(winston, 'createLogger')
      .mockImplementation()
    loggerModule.getLogger(conf, defaultConf)
    expect(createLoggerSpy).toHaveBeenCalledWith({
      levels: undefined,
      level: 'error',
      format: winston.format.simple(),
      defaultMeta: undefined,
      transports: [],
      silent: false,
      exitOnError: true,
      exceptionHandlers: [],
      rejectionHandlers: []
    })
    createLoggerSpy.mockRestore()
    const logger = loggerModule.getLogger(conf, defaultConf)
    expect(logger).toBeDefined()
  })

  test('should create a logger with simple format even if format field is null', () => {
    const conf = {
      logging: {
        logLevel: 'error',
        transports: [
          {
            type: ETransportType.CONSOLE as const
          }
        ]
      }
    }
    const defaultConf = {
      logging: { ...defaultConfDesc.logging, format: null }
    }
    const createLoggerSpy = jest
      .spyOn(winston, 'createLogger')
      .mockImplementation()
    loggerModule.getLogger(conf, defaultConf)
    expect(createLoggerSpy).toHaveBeenCalledWith({
      levels: undefined,
      level: 'error',
      format: winston.format.simple(),
      defaultMeta: undefined,
      transports: expect.anything(),
      silent: false,
      exitOnError: true,
      exceptionHandlers: [],
      rejectionHandlers: []
    })
    createLoggerSpy.mockRestore()
    const logger = loggerModule.getLogger(conf, defaultConf)
    expect(logger).toBeDefined()
  })

  test('should allow to create a logger with combine formats', () => {
    const conf = {
      logging: {
        logLevel: 'error',
        format: [
          {
            type: EFormatType.ALIGN as const
          },
          {
            type: EFormatType.TIMESTAMP as const,
            options: {
              format: 'isoDate'
            }
          }
        ],
        transports: [
          {
            type: ETransportType.CONSOLE as const
          }
        ]
      }
    }

    const createLoggerSpy = jest
      .spyOn(winston, 'createLogger')
      .mockImplementation()
    loggerModule.getLogger(conf)
    expect(createLoggerSpy).toHaveBeenCalledWith({
      levels: undefined,
      level: 'error',
      format: expect.anything(),
      defaultMeta: undefined,
      transports: expect.anything(),
      silent: false,
      exitOnError: true,
      exceptionHandlers: [],
      rejectionHandlers: []
    })
    const formatField = createLoggerSpy.mock.calls[0][0]?.format
    expect(formatField?.transform({ level: 'info', message: 'test' })).toEqual(
      winston.format
        .combine(
          winston.format.align(),
          winston.format.timestamp({
            format: 'isoDate'
          })
        )
        .transform({ level: 'info', message: 'test' })
    )
    createLoggerSpy.mockRestore()
    const logger = loggerModule.getLogger(conf)
    expect(logger).toBeDefined()
  })

  test('should throw an error if conf is not an object', () => {
    process.env.TWAKE_LOGGER_CONF = path.join(
      JEST_PROCESS_ROOT_PATH,
      'src',
      '__testData__',
      'falsy-logging-config.json'
    )
    expect(() => loggerModule.getLogger()).toThrowError(
      '[Configuration file] logging field in error: value must be an object'
    )
    delete process.env.TWAKE_LOGGER_CONF
  })

  test('should create a logger based on description file if there is no logging field in config', (done) => {
    process.env.TWAKE_LOGGER_CONF = path.join(
      JEST_PROCESS_ROOT_PATH,
      'src',
      '__testData__',
      'no-logging-config.json'
    )
    const createLoggerSpy = jest
      .spyOn(winston, 'createLogger')
      .mockImplementation()
    loggerModule.getLogger()
    expect(createLoggerSpy).toHaveBeenCalledWith({
      levels: undefined,
      level: 'info',
      format: winston.format.simple(),
      defaultMeta: undefined,
      transports: expect.anything(),
      silent: false,
      exitOnError: true,
      exceptionHandlers: [],
      rejectionHandlers: []
    })
    const transportsField = createLoggerSpy.mock.calls[0][0]
      ?.transports as TransportInstance[]
    expect(transportsField).toHaveLength(1)
    expect(transportsField[0]).toBeInstanceOf(
      winston.transports.DailyRotateFile
    )
    createLoggerSpy.mockRestore()
    const logger = loggerModule.getLogger()
    expect(logger).toBeDefined()
    setTimeout(() => {
      const rootDirPath = path.join(JEST_PROCESS_ROOT_PATH, 'logs')
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const logFilePath = path.join(
        rootDirPath,
        `twake-${moment().format('YYYY-MM-DD')}.log`
      )
      expect(fs.existsSync(logFilePath)).toEqual(true)
      fs.rmSync(rootDirPath, { recursive: true })
      delete process.env.TWAKE_LOGGER_CONF
      done()
    }, 1000)
  })

  test('should throw an error if description file has not allowed property', () => {
    const conf = JSON.parse(
      fs
        .readFileSync(
          path.join(
            JEST_PROCESS_ROOT_PATH,
            'src',
            '__testData__',
            'not-allowed-config-field.json'
          )
        )
        .toString()
    )
    expect(() =>
      loggerModule.getLogger(conf, {
        logging: {
          falsy: 'falsy'
        }
      })
    ).toThrowError(
      '[Descriptor file] logging field in error: falsy is not allowed'
    )
  })

  test('should throw an error if defaultMeta field value is not an object', () => {
    expect(() =>
      loggerModule.getLogger(
        {
          logging: {
            logLevel: 'error'
          }
        },
        {
          logging: {
            defaultMeta: 'falsy'
          }
        }
      )
    ).toThrowError(
      '[Descriptor file]: \ndefaultMeta in error: value must be an object'
    )
  })

  test('should throw an error if logger field value is equal to "Console" or "File"', () => {
    expect(() =>
      loggerModule.getLogger(
        {
          logging: {
            logLevel: 'error'
          }
        },
        {
          logging: {
            logger: 'falsy'
          }
        }
      )
    ).toThrowError(
      '[Descriptor file]: \nlogger in error: value must be equal to "Console" or "File"'
    )
  })

  test('should throw an error for several spoiled fields', () => {
    process.env.TWAKE_LOGGER_CONF = path.join(
      JEST_PROCESS_ROOT_PATH,
      'src',
      '__testData__',
      'config-with-several-errors-1.json'
    )
    expect(() => loggerModule.getLogger()).toThrowError(
      '[Configuration file]: \n' +
        'silent in error: value must be a boolean\n' +
        'exitOnError in error: value must be a boolean\n' +
        'logger in error: value must be equal to "File"\n' +
        'levels in error: value must be an objects whose keys must be of type "string" and value of type "number"\n' +
        'transports in error: array must contain objects which have a "type" property whose value must be one of the listed transports in documentation\n' +
        'format in error: "template" in "options" should be defined for "printf" format\n'
    )
    delete process.env.TWAKE_LOGGER_CONF
  })

  test('should throw an error for several other spoiled fields', () => {
    process.env.TWAKE_LOGGER_CONF = path.join(
      JEST_PROCESS_ROOT_PATH,
      'src',
      '__testData__',
      'config-with-several-errors-2.json'
    )
    expect(() => loggerModule.getLogger()).toThrowError(
      '[Configuration file]: \n' +
        'logFile in error: value must be a string\n' +
        'logLevel in error: value must equal to one of levels keys\n' +
        'transports in error: array must contain objects which have an optional "options" property whose value must be an object\n' +
        'format in error: "options" should not be defined for align format\n'
    )
    delete process.env.TWAKE_LOGGER_CONF
  })

  test('should throw an error if transports is not an array or if format does not contain type property', () => {
    process.env.TWAKE_LOGGER_CONF = path.join(
      JEST_PROCESS_ROOT_PATH,
      'src',
      '__testData__',
      'config-with-several-errors-3.json'
    )
    expect(() => loggerModule.getLogger()).toThrowError(
      '[Configuration file]: \n' +
        'transports in error: value should be an array of objects\n' +
        'format in error: value should be an object or an array of objects which have a "type" property whose value must be one of the listed format in documentation\n'
    )
    delete process.env.TWAKE_LOGGER_CONF
  })
})
