import fs from 'fs'
import path from 'path'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { getLogger, type TwakeLogger } from '.'
import JEST_PROCESS_ROOT_PATH from '../jest.globals'
import confDesc from './configDesc.json'
import { ETransportType, type TransportInstance } from './types'

describe('Logger', () => {
  describe('Error cases', () => {
    it('should throw an error if conf is not an object', () => {
      expect(() => getLogger('falsy' as any)).toThrow(
        'logger configuration in error: conf must be an object'
      )
    })

    it('should throw an error if logging field is not an object', () => {
      process.env.TWAKE_LOGGER_CONF = path.join(
        JEST_PROCESS_ROOT_PATH,
        'src',
        '__testData__',
        'falsy-logging-config.json'
      )
      expect(() => getLogger()).toThrow(
        'logging field in error: value must be an object'
      )
      delete process.env.TWAKE_LOGGER_CONF
    })

    it('should throw an error if configuration file has not allowed property', () => {
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
      expect(() => getLogger(conf)).toThrow(
        "Configuration key 'falsy' isn't accepted as it's not defined in the ConfigDescription."
      )
    })

    it('should throw an error if log_level is not a string', () => {
      expect(() =>
        getLogger({
          logging: {
            log_level: false as any,
            default_meta: {
              test: 'test'
            }
          }
        })
      ).toThrow(
        'log_level in error: value must equal to one of default npm levels'
      )
    })

    it('should throw an error if log_level is not equal to one of default npm levels', () => {
      expect(() =>
        getLogger({
          logging: {
            log_level: 'falsy',
            default_meta: {
              test: 'test'
            }
          }
        })
      ).toThrow(
        'log_level in error: value must equal to one of default npm levels'
      )
    })

    it('should throw an error if LOG_LEVEL environment variable is not equal to one of default npm levels', () => {
      process.env.LOG_LEVEL = 'falsy'
      expect(() => getLogger()).toThrow(
        'log_level in error: value must equal to one of default npm levels'
      )
      delete process.env.LOG_LEVEL
    })

    it('should throw an error if silent is not a boolean', () => {
      expect(() =>
        getLogger({
          logging: {
            log_level: 'error',
            silent: 'falsy' as any
          }
        })
      ).toThrow('silent in error: value must be a boolean')
    })

    it('should throw an error if exit_on_error is not a boolean', () => {
      expect(() =>
        getLogger({
          logging: {
            log_level: 'error',
            exit_on_error: 'falsy' as any
          }
        })
      ).toThrow('exit_on_error in error: value must be a boolean')
    })

    it('should throw an error if default_meta field value is not an object', () => {
      expect(() =>
        getLogger({
          logging: {
            log_level: 'error',
            default_meta: 'falsy' as any,
            exception_handlers: []
          }
        })
      ).toThrow('default_meta in error: value must be an object')
    })

    it('should throw error if log_transports type value is an array but does not contain ITransportConf objects', () => {
      expect(() =>
        getLogger({ logging: { log_transports: [false, 'test'] as any } })
      ).toThrow(
        'log_transports.type in error: value must be one of the listed transports in documentation'
      )
    })

    it('should throw error if log_transports type value is not a string', () => {
      expect(() =>
        getLogger({ logging: { log_transports: [{ type: false }] as any } })
      ).toThrow(
        'log_transports.type in error: value must be one of the listed transports in documentation'
      )
    })

    it('should throw error if log_transports type value is not supported', () => {
      process.env.TWAKE_LOGGER_CONF = path.join(
        JEST_PROCESS_ROOT_PATH,
        'src',
        '__testData__',
        'falsy-transport-config.json'
      )
      expect(() => getLogger()).toThrow(
        'log_transports.type in error: value must be one of the listed transports in documentation'
      )
      delete process.env.TWAKE_LOGGER_CONF
    })

    it('should throw error if LOG_TRANSPORTS environment variable value is not supported', () => {
      process.env.LOG_TRANSPORTS = 'falsy'
      expect(() => getLogger()).toThrow(
        'log_transports.type in error: value must be one of the listed transports in documentation'
      )
      delete process.env.LOG_TRANSPORTS
    })

    describe('Console Transport', () => {
      it('should throw error if console transport conf options field is not an object', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.CONSOLE,
                  options: 'falsy' as any
                }
              ]
            }
          })
        ).toThrow('log_transports.options in error: value must be an object')
      })

      it('should throw error if console transport conf options.eol field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.CONSOLE,
                  options: { eol: false as any }
                }
              ]
            }
          })
        ).toThrow('log_transports.options.eol in error: value must be a string')
      })

      it('should throw error if console transport conf options.stderrLevels field is not an array', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.CONSOLE,
                  options: { stderrLevels: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.stderrLevels in error: value must an array containing default npm levels as string'
        )
      })

      it('should throw error if console transport conf options.stderrLevels field is not a string array', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.CONSOLE,
                  options: { stderrLevels: [false, 123, 'test'] as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.stderrLevels in error: value must an array containing default npm levels as string'
        )
      })

      it('should throw error if console transport conf options.stderrLevels field is not an array containing npm levels', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.CONSOLE,
                  options: { stderrLevels: ['test', 'toto'] as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.stderrLevels in error: value must an array containing default npm levels as string'
        )
      })

      it('should throw error if console transport conf options.consoleWarnLevels field is not an array', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.CONSOLE,
                  options: { consoleWarnLevels: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.consoleWarnLevels in error: value must an array containing default npm levels as string'
        )
      })

      it('should throw error if console transport conf options.consoleWarnLevels field is not a string array', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.CONSOLE,
                  options: { consoleWarnLevels: [false, 123, 'test'] as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.consoleWarnLevels in error: value must an array containing default npm levels as string'
        )
      })

      it('should throw error if console transport conf options.consoleWarnLevels field is not an array containing npm levels', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.CONSOLE,
                  options: { consoleWarnLevels: ['test', 'toto'] as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.consoleWarnLevels in error: value must an array containing default npm levels as string'
        )
      })

      describe('Default Transport Options', () => {
        it('should throw error if console transport conf options.level field is not a string', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.CONSOLE,
                    options: { level: false as any }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.level in error: value must equal to one of default npm levels'
          )
        })

        it('should throw error if console transport conf options.level value is not supported', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.CONSOLE,
                    options: { level: 'falsy' as any }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.level in error: value must equal to one of default npm levels'
          )
        })

        it('should throw error if file transport conf options.silent field is not a boolean', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.CONSOLE,
                    options: { silent: 'toto' as any }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.silent in error: value must be a boolean'
          )
        })

        it('should throw error if file transport conf options.handleExceptions field is not a boolean', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.CONSOLE,
                    options: { handleExceptions: 'toto' as any }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.handleExceptions in error: value must be a boolean'
          )
        })

        it('should throw error if file transport conf options.handleRejections field is not a boolean', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.CONSOLE,
                    options: { handleRejections: 'toto' as any }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.handleRejections in error: value must be a boolean'
          )
        })
      })
    })

    describe('File Transport', () => {
      it('should throw error if file transport conf options field is not an object', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.FILE,
                  options: 'falsy' as any
                }
              ]
            }
          })
        ).toThrow('log_transports.options in error: value must be an object')
      })

      it('should throw error if file transport conf options.eol field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.FILE,
                  options: { eol: false as any }
                }
              ]
            }
          })
        ).toThrow('log_transports.options.eol in error: value must be a string')
      })

      it('should throw error if file transport conf options.lazy field is not a boolean', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.FILE,
                  options: { lazy: 'toto' as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.lazy in error: value must be a boolean'
        )
      })

      it('should throw error if file transport conf options.dirname field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.FILE,
                  options: { dirname: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.dirname in error: value must be a string'
        )
      })

      it('should throw error if file transport conf options.filename field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.FILE,
                  options: { filename: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.filename in error: value must be a string'
        )
      })

      it('should throw error if file transport conf options.maxsize field is not a number', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.FILE,
                  options: { maxsize: 'toto' as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.maxsize in error: value must be a number'
        )
      })

      it('should throw error if file transport conf options.maxFiles field is not a number', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.FILE,
                  options: { maxFiles: 'toto' as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.maxFiles in error: value must be a number'
        )
      })

      it('should throw error if file transport conf options.tailable field is not a boolean', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.FILE,
                  options: { tailable: 'toto' as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.tailable in error: value must be a boolean'
        )
      })

      it('should throw error if file transport conf options.zippedArchive field is not a boolean', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.FILE,
                  options: { zippedArchive: 'toto' as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.zippedArchive in error: value must be a boolean'
        )
      })

      it('should throw error if file transport conf options.options field is not an object', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.FILE,
                  options: { options: 'toto' as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.options in error: value must be an object'
        )
      })

      describe('Write File Options', () => {
        it('should throw error if file transport conf options.options.flags field is not a string', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.FILE,
                    options: { options: { flags: false as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.flags in error: value must be a string and equal to one of the flags supported by Node'
          )
        })

        it('should throw error if file transport conf options.options.flags value is not supported', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.FILE,
                    options: { options: { flags: 'falsy' as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.flags in error: value must be a string and equal to one of the flags supported by Node'
          )
        })

        it('should throw error if file transport conf options.options.encoding field is not a string', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.FILE,
                    options: { options: { encoding: false as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.encoding in error: value must be a string'
          )
        })

        it('should throw error if file transport conf options.options.encoding field is not a number', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.FILE,
                    options: { options: { mode: false as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.mode in error: value must be a number'
          )
        })

        it('should throw error if file transport conf options.options.autoClose field is not a boolean', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.FILE,
                    options: { options: { autoClose: 'toto' as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.autoClose in error: value must be a boolean'
          )
        })

        it('should throw error if file transport conf options.options.emitClose field is not a boolean', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.FILE,
                    options: { options: { emitClose: 'toto' as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.emitClose in error: value must be a boolean'
          )
        })

        it('should throw error if file transport conf options.options.start field is not a number', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.FILE,
                    options: { options: { start: false as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.start in error: value must be a number'
          )
        })

        it('should throw error if file transport conf options.options.highWaterMark field is not a number', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.FILE,
                    options: { options: { highWaterMark: false as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.highWaterMark in error: value must be a number'
          )
        })

        it('should throw error if file transport conf options.options.flush field is not a boolean', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.FILE,
                    options: { options: { flush: 'toto' as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.flush in error: value must be a boolean'
          )
        })
      })
    })

    describe('Daily Rotate Transport', () => {
      it('should throw error if daily rotate transport conf options field is not an object', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: 'falsy' as any
                }
              ]
            }
          })
        ).toThrow('log_transports.options in error: value must be an object')
      })

      it('should throw error if daily rotate transport conf options.frequency field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { frequency: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.frequency in error: value must be a string which follows pattern <integer> with "m" or "h" as suffix'
        )
      })

      it('should throw error if daily rotate transport conf options.frequency does not match pattern', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { frequency: 'toto' }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.frequency in error: value must be a string which follows pattern <integer> with "m" or "h" as suffix'
        )
      })

      it('should throw error if daily rotate transport conf options.datePattern field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { datePattern: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.datePattern in error: value must be a string which represents a format supported by moment.js library'
        )
      })

      it('should throw error if daily rotate transport conf options.zippedArchive field is not a boolean', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { zippedArchive: 'toto' as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.zippedArchive in error: value must be a boolean'
        )
      })

      it('should throw error if daily rotate transport conf options.filename field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { filename: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.filename in error: value must be a string'
        )
      })

      it('should throw error if daily rotate transport conf options.dirname field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { dirname: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.dirname in error: value must be a string'
        )
      })

      it('should throw error if daily rotate transport conf options.maxSize field is not a number or a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { maxSize: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.maxSize in error: value must be a number or a string which follows pattern <integer> with "k", "m" or "g" as suffix'
        )
      })

      it('should throw error if daily rotate transport conf options.maxSize is a string which does not respect pattern', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { maxSize: 'falsy' }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.maxSize in error: value must be a number or a string which follows pattern <integer> with "k", "m" or "g" as suffix'
        )
      })

      it('should throw error if daily rotate transport conf options.maxFiles field is not a number or a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { maxFiles: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.maxFiles in error: value must be a number or a string which follows pattern <integer> with "d" as suffix'
        )
      })

      it('should throw error if daily rotate transport conf options.maxFiles field  is a string which does not respect pattern', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { maxFiles: 'falsy' }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.maxFiles in error: value must be a number or a string which follows pattern <integer> with "d" as suffix'
        )
      })

      it('should throw error if daily rotate transport conf options.options field is not an object', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { options: 'toto' as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.options in error: value must be an object'
        )
      })

      it('should throw error if daily rotate transport conf options.auditFile field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { auditFile: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.auditFile in error: value must be a string'
        )
      })

      it('should throw error if daily rotate transport conf options.utc field is not a boolean', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { utc: 'toto' as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.utc in error: value must be a boolean'
        )
      })

      it('should throw error if daily rotate transport conf options.extension field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { extension: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.extension in error: value must be a string'
        )
      })

      it('should throw error if daily rotate transport conf options.createSymlink field is not a boolean', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { createSymlink: 'toto' as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.createSymlink in error: value must be a boolean'
        )
      })

      it('should throw error if daily rotate transport conf options.symlinkName field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { symlinkName: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.symlinkName in error: value must be a string'
        )
      })

      it('should throw error if daily rotate transport conf options.auditHashType field is not a string', () => {
        expect(() =>
          getLogger({
            logging: {
              log_transports: [
                {
                  type: ETransportType.DAILY_ROTATE_FILE,
                  options: { auditHashType: false as any }
                }
              ]
            }
          })
        ).toThrow(
          'log_transports.options.auditHashType in error: value must be a string'
        )
      })

      describe('Write File Options', () => {
        it('should throw error if daily rotate transport conf options.options.flags field is not a string', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.DAILY_ROTATE_FILE,
                    options: { options: { flags: false as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.flags in error: value must be a string and equal to one of the flags supported by Node'
          )
        })

        it('should throw error if daily rotate transport conf options.options.flags value is not supported', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.DAILY_ROTATE_FILE,
                    options: { options: { flags: 'falsy' as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.flags in error: value must be a string and equal to one of the flags supported by Node'
          )
        })

        it('should throw error if daily rotate transport conf options.options.encoding field is not a string', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.DAILY_ROTATE_FILE,
                    options: { options: { encoding: false as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.encoding in error: value must be a string'
          )
        })

        it('should throw error if daily rotate transport conf options.options.encoding field is not a number', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.DAILY_ROTATE_FILE,
                    options: { options: { mode: false as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.mode in error: value must be a number'
          )
        })

        it('should throw error if daily rotate transport conf options.options.autoClose field is not a boolean', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.DAILY_ROTATE_FILE,
                    options: { options: { autoClose: 'toto' as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.autoClose in error: value must be a boolean'
          )
        })

        it('should throw error if daily rotate transport conf options.options.emitClose field is not a boolean', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.DAILY_ROTATE_FILE,
                    options: { options: { emitClose: 'toto' as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.emitClose in error: value must be a boolean'
          )
        })

        it('should throw error if daily rotate transport conf options.options.start field is not a number', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.DAILY_ROTATE_FILE,
                    options: { options: { start: false as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.start in error: value must be a number'
          )
        })

        it('should throw error if daily rotate transport conf options.options.highWaterMark field is not a number', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.DAILY_ROTATE_FILE,
                    options: { options: { highWaterMark: false as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.highWaterMark in error: value must be a number'
          )
        })

        it('should throw error if daily rotate transport conf options.options.flush field is not a boolean', () => {
          expect(() =>
            getLogger({
              logging: {
                log_transports: [
                  {
                    type: ETransportType.DAILY_ROTATE_FILE,
                    options: { options: { flush: 'toto' as any } }
                  }
                ]
              }
            })
          ).toThrow(
            'log_transports.options.options.flush in error: value must be a boolean'
          )
        })
      })
    })

    it('should throw error if exception_handlers type value is not supported', () => {
      expect(() =>
        getLogger({
          logging: { exception_handlers: [{ type: 'falsy' as any }] }
        })
      ).toThrow(
        'exception_handlers.type in error: value must be one of the listed transports in documentation'
      )
    })

    it('should throw error if rejection_handlers type value is not supported', () => {
      expect(() =>
        getLogger({
          logging: { rejection_handlers: [{ type: 'falsy' as any }] }
        })
      ).toThrow(
        'rejection_handlers.type in error: value must be one of the listed transports in documentation'
      )
    })
  })

  describe('Creation cases', () => {
    let logger: TwakeLogger | undefined

    afterEach(() => {
      logger?.close()
      logger = undefined
    })

    it('should create console logger based on environment variables', () => {
      const createLoggerSpy = jest
        .spyOn(winston, 'createLogger')
        .mockImplementation()

      process.env.LOG_TRANSPORTS = 'Console'
      process.env.LOG_LEVEL = 'warn'

      getLogger()
      expect(createLoggerSpy).toHaveBeenCalledWith({
        level: 'warn',
        format: expect.anything(),
        defaultMeta: undefined,
        transports: expect.anything(),
        silent: false,
        exitOnError: false,
        exceptionHandlers: [],
        rejectionHandlers: []
      })

      const transportsField = createLoggerSpy.mock.calls[0][0]
        ?.transports as TransportInstance[]
      expect(transportsField).toHaveLength(1)
      expect(transportsField[0]).toBeInstanceOf(winston.transports.Console)

      createLoggerSpy.mockRestore()
      expect(logger).not.toBeDefined()
      logger = getLogger()
      expect(logger).toBeDefined()

      delete process.env.LOG_TRANSPORTS
      delete process.env.LOG_LEVEL
    })

    it('should create console logger based on config.json file', () => {
      process.env.TWAKE_LOGGER_CONF = path.join(
        JEST_PROCESS_ROOT_PATH,
        'src',
        '__testData__',
        'console-config.json'
      )
      const createLoggerSpy = jest
        .spyOn(winston, 'createLogger')
        .mockImplementation()

      getLogger()
      expect(createLoggerSpy).toHaveBeenCalledWith({
        level: 'warn',
        format: expect.anything(),
        defaultMeta: undefined,
        transports: expect.anything(),
        silent: false,
        exitOnError: false,
        exceptionHandlers: [],
        rejectionHandlers: []
      })

      const transportsField = createLoggerSpy.mock.calls[0][0]
        ?.transports as TransportInstance[]
      expect(transportsField).toHaveLength(1)
      expect(transportsField[0]).toBeInstanceOf(winston.transports.Console)

      createLoggerSpy.mockRestore()

      expect(logger).not.toBeDefined()
      logger = getLogger()
      expect(logger).toBeDefined()

      delete process.env.TWAKE_LOGGER_CONF
    })

    it('should create file logger based on environment variables', (done) => {
      const createLoggerSpy = jest
        .spyOn(winston, 'createLogger')
        .mockImplementation()

      process.env.LOG_TRANSPORTS = 'File'
      process.env.LOG_LEVEL = 'warn'
      process.env.LOG_FILE = 'test-logs.txt'
      const logFilePath = path.join(
        JEST_PROCESS_ROOT_PATH,
        process.env.LOG_FILE
      )

      getLogger()
      expect(createLoggerSpy).toHaveBeenCalledWith({
        level: 'warn',
        format: expect.anything(),
        defaultMeta: undefined,
        transports: expect.anything(),
        silent: false,
        exitOnError: false,
        exceptionHandlers: [],
        rejectionHandlers: []
      })

      const transportsField = createLoggerSpy.mock.calls[0][0]
        ?.transports as TransportInstance[]
      expect(transportsField).toHaveLength(1)
      expect(transportsField[0]).toBeInstanceOf(winston.transports.File)

      createLoggerSpy.mockRestore()

      expect(logger).not.toBeDefined()
      logger = getLogger()
      expect(logger).toBeDefined()
      setTimeout(() => {
        expect(fs.existsSync(logFilePath)).toEqual(true)
        fs.unlinkSync(logFilePath)
        delete process.env.LOG_TRANSPORTS
        delete process.env.LOG_LEVEL
        delete process.env.LOG_FILE
        done()
      }, 1000)
    })

    it('should create file logger based on environment variables with default filename', (done) => {
      const createLoggerSpy = jest
        .spyOn(winston, 'createLogger')
        .mockImplementation()

      process.env.LOG_TRANSPORTS = 'File'
      process.env.LOG_LEVEL = 'warn'
      const logFilePath = path.join(JEST_PROCESS_ROOT_PATH, 'twake.log')

      getLogger()
      expect(createLoggerSpy).toHaveBeenCalledWith({
        level: 'warn',
        format: expect.anything(),
        defaultMeta: undefined,
        transports: expect.anything(),
        silent: false,
        exitOnError: false,
        exceptionHandlers: [],
        rejectionHandlers: []
      })

      const transportsField = createLoggerSpy.mock.calls[0][0]
        ?.transports as TransportInstance[]
      expect(transportsField).toHaveLength(1)
      expect(transportsField[0]).toBeInstanceOf(winston.transports.File)

      createLoggerSpy.mockRestore()

      expect(logger).not.toBeDefined()
      logger = getLogger()
      expect(logger).toBeDefined()
      setTimeout(() => {
        expect(fs.existsSync(logFilePath)).toEqual(true)
        fs.unlinkSync(logFilePath)
        delete process.env.LOG_TRANSPORTS
        delete process.env.LOG_LEVEL
        done()
      }, 1000)
    })

    it('should create a console logger and a file logger based on environment variables', (done) => {
      const createLoggerSpy = jest
        .spyOn(winston, 'createLogger')
        .mockImplementation()

      process.env.LOG_TRANSPORTS = 'Console,File'
      process.env.LOG_LEVEL = 'warn'
      const logFilePath = path.join(JEST_PROCESS_ROOT_PATH, 'twake.log')

      getLogger()
      expect(createLoggerSpy).toHaveBeenCalledWith({
        level: 'warn',
        format: expect.anything(),
        defaultMeta: undefined,
        transports: expect.anything(),
        silent: false,
        exitOnError: false,
        exceptionHandlers: [],
        rejectionHandlers: []
      })

      const transportsField = createLoggerSpy.mock.calls[0][0]
        ?.transports as TransportInstance[]
      expect(transportsField).toHaveLength(2)
      expect(transportsField[0]).toBeInstanceOf(winston.transports.Console)
      expect(transportsField[1]).toBeInstanceOf(winston.transports.File)

      createLoggerSpy.mockRestore()

      expect(logger).not.toBeDefined()
      logger = getLogger()
      expect(logger).toBeDefined()
      setTimeout(() => {
        expect(fs.existsSync(logFilePath)).toEqual(true)
        fs.unlinkSync(logFilePath)
        delete process.env.LOG_TRANSPORTS
        delete process.env.LOG_LEVEL
        done()
      }, 1000)
    })

    it('should create a logger even if transports field is null', () => {
      const conf = {
        logging: {
          log_level: 'error'
        }
      }
      const defaultConf = {
        logging: {
          ...confDesc.logging,
          log_transports: {
            type: 'array',
            required: false
          }
        }
      }

      const createLoggerSpy = jest
        .spyOn(winston, 'createLogger')
        .mockImplementation()

      getLogger(conf, defaultConf)
      expect(createLoggerSpy).toHaveBeenCalledWith({
        level: 'error',
        format: expect.anything(),
        defaultMeta: undefined,
        transports: expect.anything(),
        silent: false,
        exitOnError: false,
        exceptionHandlers: [],
        rejectionHandlers: []
      })

      const transportsField = createLoggerSpy.mock.calls[0][0]
        ?.transports as TransportInstance[]
      expect(transportsField).toHaveLength(1)
      expect(transportsField[0]).toBeInstanceOf(winston.transports.Console)

      createLoggerSpy.mockRestore()

      expect(logger).not.toBeDefined()
      logger = getLogger(conf, defaultConf)
      expect(logger).toBeDefined()
    })

    it('should create a logger based on description file if config is an empty object', () => {
      const createLoggerSpy = jest
        .spyOn(winston, 'createLogger')
        .mockImplementation()

      getLogger({})
      expect(createLoggerSpy).toHaveBeenCalledWith({
        level: 'info',
        format: expect.anything(),
        defaultMeta: undefined,
        transports: expect.anything(),
        silent: false,
        exitOnError: false,
        exceptionHandlers: [],
        rejectionHandlers: []
      })

      const transportsField = createLoggerSpy.mock.calls[0][0]
        ?.transports as TransportInstance[]
      expect(transportsField).toHaveLength(1)
      expect(transportsField[0]).toBeInstanceOf(winston.transports.Console)

      createLoggerSpy.mockRestore()

      expect(logger).not.toBeDefined()
      logger = getLogger()
      expect(logger).toBeDefined()
    })

    it('should create daily logger based on config json object', (done) => {
      const createLoggerSpy = jest
        .spyOn(winston, 'createLogger')
        .mockImplementation()

      const conf = {
        logging: {
          log_level: 'info',
          log_transports: [
            {
              type: ETransportType.DAILY_ROTATE_FILE
            }
          ]
        }
      }

      getLogger(conf)
      expect(createLoggerSpy).toHaveBeenCalledWith({
        level: 'info',
        format: expect.anything(),
        defaultMeta: undefined,
        transports: expect.anything(),
        silent: false,
        exitOnError: false,
        exceptionHandlers: [],
        rejectionHandlers: []
      })

      const transportsField = createLoggerSpy.mock.calls[0][0]
        ?.transports as TransportInstance[]
      expect(transportsField).toHaveLength(1)
      expect(transportsField[0]).toBeInstanceOf(DailyRotateFile)

      createLoggerSpy.mockRestore()

      expect(logger).not.toBeDefined()
      logger = getLogger(conf)
      expect(logger).toBeDefined()
      setTimeout(() => {
        const date = new Date()
        const logFilePath = path.join(
          JEST_PROCESS_ROOT_PATH,
          `twake-${date.getFullYear()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, '0')}-${date
            .getUTCDate()
            .toString()
            .padStart(2, '0')}.log`
        )
        expect(fs.existsSync(logFilePath)).toEqual(true)
        fs.unlinkSync(logFilePath)
        delete process.env.LOG_TRANSPORTS
        delete process.env.LOG_LEVEL
        done()
      }, 1000)
    })

    it('should set rejection_handlers and exception_handlers to empty array if their values are null or undefined', () => {
      const conf = {
        logging: {
          log_level: 'error'
        }
      }
      const defaultConf = {
        logging: {
          ...confDesc.logging,
          rejection_handlers: {
            type: 'array',
            required: false
          },
          exception_handlers: {
            type: 'array',
            required: false
          }
        }
      }

      const createLoggerSpy = jest
        .spyOn(winston, 'createLogger')
        .mockImplementation()

      getLogger(conf, defaultConf)
      expect(createLoggerSpy).toHaveBeenCalledWith({
        level: 'error',
        format: expect.anything(),
        defaultMeta: undefined,
        transports: expect.anything(),
        silent: false,
        exitOnError: false,
        exceptionHandlers: [],
        rejectionHandlers: []
      })

      createLoggerSpy.mockRestore()

      expect(logger).not.toBeDefined()
      logger = getLogger(conf, defaultConf)
      expect(logger).toBeDefined()
    })

    it('should create logger with transports intances for rejectionHandlers and exceptionHandlers fields', () => {
      const conf = {
        logging: {
          log_level: 'error',
          exception_handlers: [{ type: ETransportType.CONSOLE }],
          rejection_handlers: [{ type: ETransportType.CONSOLE }]
        }
      }
      const defaultConf = {
        logging: {
          ...confDesc.logging,
          rejection_handlers: {
            type: 'array',
            required: false
          },
          exception_handlers: {
            type: 'array',
            required: false
          }
        }
      }

      const createLoggerSpy = jest
        .spyOn(winston, 'createLogger')
        .mockImplementation()

      getLogger(conf, defaultConf)
      expect(createLoggerSpy).toHaveBeenCalledWith({
        level: 'error',
        format: expect.anything(),
        defaultMeta: undefined,
        transports: expect.anything(),
        silent: false,
        exitOnError: false,
        exceptionHandlers: expect.anything(),
        rejectionHandlers: expect.anything()
      })

      const transportsField = createLoggerSpy.mock.calls[0][0]
        ?.transports as TransportInstance[]
      expect(transportsField).toHaveLength(1)
      expect(transportsField[0]).toBeInstanceOf(winston.transports.Console)

      const exceptionHandlersField = createLoggerSpy.mock.calls[0][0]
        ?.exceptionHandlers as TransportInstance[]
      expect(exceptionHandlersField).toHaveLength(1)
      expect(exceptionHandlersField[0]).toBeInstanceOf(
        winston.transports.Console
      )

      const rejectionHandlersField = createLoggerSpy.mock.calls[0][0]
        ?.rejectionHandlers as TransportInstance[]
      expect(rejectionHandlersField).toHaveLength(1)
      expect(rejectionHandlersField[0]).toBeInstanceOf(
        winston.transports.Console
      )

      createLoggerSpy.mockRestore()

      expect(logger).not.toBeDefined()
      logger = getLogger(conf, defaultConf)
      expect(logger).toBeDefined()
    })

    it('should create a file logger with the predefined template', (done) => {
      const conf = {
        logging: {
          log_level: 'error',
          log_transports: [
            {
              type: ETransportType.FILE,
              options: {
                filename: 'logs.txt'
              }
            }
          ]
        }
      }

      const logFile = path.join(JEST_PROCESS_ROOT_PATH, 'logs.txt')

      expect(logger).not.toBeDefined()
      logger = getLogger(conf)
      expect(logger).toBeDefined()
      logger.error('test message')
      setTimeout(() => {
        expect(fs.existsSync(logFile)).toEqual(true)
        const data = fs.readFileSync(logFile, 'utf8')
        // (\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))? is regular expression for ISO Date
        expect(data).toMatch(
          // eslint-disable-next-line no-useless-escape
          /^ERROR \| (\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))? \| test message\n$/
        )
        fs.unlinkSync(logFile)
        done()
      }, 100)
    })

    it('should create a file logger which allows to display message with request details', (done) => {
      const conf = {
        logging: {
          log_level: 'error',
          log_transports: [
            {
              type: ETransportType.FILE,
              options: {
                filename: 'logs.txt'
              }
            }
          ]
        }
      }

      const ip = '192.168.0.1'
      const matrixUserId = '@test:example.com'
      const httpMethod = 'GET'
      const requestUrl = 'test_url'
      const endpointPath = 'test_endpoint'
      const status = 200

      const logFile = path.join(JEST_PROCESS_ROOT_PATH, 'logs.txt')

      expect(logger).not.toBeDefined()
      logger = getLogger(conf)
      expect(logger).toBeDefined()
      logger.error('test message', {
        ip,
        matrixUserId,
        httpMethod,
        requestUrl,
        endpointPath,
        status
      })
      setTimeout(() => {
        expect(fs.existsSync(logFile)).toEqual(true)
        const data = fs.readFileSync(logFile, 'utf8')
        // (\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))? is regular expression for ISO Date
        expect(data).toMatch(
          // eslint-disable-next-line no-useless-escape
          /^ERROR \| (\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))? \| 192\.168\.0\.1 \| @test\:example\.com \| GET \| test_url \| test_endpoint \| 200 \| test message\n$/
        )
        fs.unlinkSync(logFile)
        done()
      }, 100)
    })

    it('should create a file logger which allows to display message with partial request details', (done) => {
      const conf = {
        logging: {
          log_level: 'error',
          log_transports: [
            {
              type: ETransportType.FILE,
              options: {
                filename: 'logs.txt'
              }
            }
          ]
        }
      }

      const ip = '192.168.0.1'
      const httpMethod = 'GET'
      const requestUrl = 'test_url'
      const status = 200

      const logFile = path.join(JEST_PROCESS_ROOT_PATH, 'logs.txt')

      expect(logger).not.toBeDefined()
      logger = getLogger(conf)
      expect(logger).toBeDefined()
      logger.error('test message', {
        ip,
        httpMethod,
        requestUrl,
        status
      })
      setTimeout(() => {
        expect(fs.existsSync(logFile)).toEqual(true)
        const data = fs.readFileSync(logFile, 'utf8')
        // (\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))? is regular expression for ISO Date
        expect(data).toMatch(
          // eslint-disable-next-line no-useless-escape
          /^ERROR \| (\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))? \| 192\.168\.0\.1 \| GET \| test_url \| 200 \| test message\n$/
        )
        fs.unlinkSync(logFile)
        done()
      }, 100)
    })

    it('should create a file logger which allows to display message with request details and additionnal details', (done) => {
      const conf = {
        logging: {
          log_level: 'error',
          log_transports: [
            {
              type: ETransportType.FILE,
              options: {
                filename: 'logs.txt'
              }
            }
          ]
        }
      }

      const ip = '192.168.0.1'
      const httpMethod = 'GET'
      const requestUrl = 'test_url'
      const status = 200

      const logFile = path.join(JEST_PROCESS_ROOT_PATH, 'logs.txt')

      expect(logger).not.toBeDefined()
      logger = getLogger(conf)
      expect(logger).toBeDefined()
      logger.error('test message', {
        ip,
        httpMethod,
        requestUrl,
        status,
        cause: 'This is the cause',
        stack: 'This is the stack'
      })
      setTimeout(() => {
        expect(fs.existsSync(logFile)).toEqual(true)
        const data = fs.readFileSync(logFile, 'utf8')
        // (\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))? is regular expression for ISO Date
        expect(data).toMatch(
          // eslint-disable-next-line no-useless-escape
          /^ERROR \| (\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))? \| 192\.168\.0\.1 \| GET \| test_url \| 200 \| test message | This is the cause | This is the stack\n$/
        )
        fs.unlinkSync(logFile)
        done()
      }, 100)
    })
  })
})
