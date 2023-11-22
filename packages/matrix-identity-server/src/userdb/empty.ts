import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import { type Config, type DbGetResult } from '../types'
import { type UserDBBackend } from './index'

class UserDBEmpty implements UserDBBackend {
  ready: Promise<void>
  private readonly _logger: TwakeLogger
  get logger(): TwakeLogger {
    return this._logger
  }

  constructor(conf: Config, logger?: TwakeLogger) {
    this._logger = logger ?? getLogger(conf as unknown as LoggerConfig)
    this.ready = Promise.resolve()
    this.logger.warn('Running a fake user database')
  }

  async get(...any: any[]): Promise<DbGetResult> {
    return []
  }

  async getAll(...any: any[]): Promise<DbGetResult> {
    return []
  }

  async match(...any: any[]): Promise<DbGetResult> {
    return []
  }

  close(): void {}
}

export default UserDBEmpty
