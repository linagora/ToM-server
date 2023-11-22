import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import type Cache from '../cache'
import { type Config, type DbGetResult } from '../types'
import UserDBLDAP from './ldap'
import UserDBPg from './sql/pg'
import UserDBSQLite from './sql/sqlite'

export type SupportedUserDatabases = 'sqlite' | 'pg' | 'ldap'

export type Collections = 'users' | 'groups'

type Get = (
  table: Collections,
  fields?: string[],
  filterFields?: Record<string, string | number | string[]>
) => Promise<DbGetResult>
type GetAll = (
  table: Collections,
  fields: string[],
  order?: string
) => Promise<DbGetResult>
type Match = (
  table: Collections,
  fields: string[],
  searchFields: string[],
  value: string | number,
  order?: string
) => Promise<DbGetResult>

export interface UserDBBackend {
  ready: Promise<void>
  get: Get
  getAll: GetAll
  match: Match
  close: () => void
}

class UserDB implements UserDBBackend {
  ready: Promise<void>
  db: UserDBBackend
  cache?: Cache
  private readonly _logger: TwakeLogger
  get logger(): TwakeLogger {
    return this._logger
  }

  constructor(conf: Config, cache?: Cache, logger?: TwakeLogger) {
    this._logger = logger ?? getLogger(conf as unknown as LoggerConfig)
    this.cache = cache
    let Module
    /* istanbul ignore next */
    switch (conf.userdb_engine) {
      case 'sqlite': {
        Module = UserDBSQLite
        break
      }
      case 'pg': {
        Module = UserDBPg
        break
      }
      case 'ldap': {
        Module = UserDBLDAP
        break
      }
      default: {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Unsupported user-database type ${conf.userdb_engine}`)
      }
    }
    this.db = new Module(conf, this.logger)
    this.ready = new Promise((resolve, reject) => {
      this.db.ready
        .then(() => {
          // TODO: insert here init if needed
          resolve()
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  get(
    table: Collections,
    fields?: string[],
    filterFields?: Record<string, string | number | string[]>
  ) {
    return this.db.get(table, fields, filterFields)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  match(
    table: Collections,
    fields: string[],
    searchFields: string[],
    value: string | number,
    order?: string
  ) {
    if (typeof order !== 'string' || !/^[\w-]+$/.test(order)) order = undefined
    return this.db.match(table, fields, searchFields, value, order)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getAll(
    table: Collections,
    fields: string[],
    order?: string
  ): Promise<DbGetResult> {
    if (typeof order !== 'string' || !/^[\w-]+$/.test(order)) order = undefined
    if (this.cache != null) {
      return new Promise((resolve, reject) => {
        let key: string = [table, ...fields].join(',')
        if (order != null) key += `_${order}`
        ;(this.cache as Cache)
          .get(key)
          .then((data) => {
            if (data == null) throw new Error()
            resolve(data)
          })
          .catch(() => {
            this.db
              .getAll(table, fields, order)
              .then((res) => {
                ;(this.cache as Cache).set(key, res).catch(this.logger.error)
                resolve(res)
              })
              .catch(reject)
          })
      })
    } else {
      return this.db.getAll(table, fields, order)
    }
  }

  close(): void {
    this.db.close()
  }
}

export default UserDB
