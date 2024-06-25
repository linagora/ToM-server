import { type TwakeLogger } from '@twake/logger'
import { type Config, type DbGetResult } from '../types'
import { type UserDBBackend } from './index'

class UserDBEmpty implements UserDBBackend {
  ready: Promise<void>
  constructor(_conf: Config, private readonly logger: TwakeLogger) {
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
