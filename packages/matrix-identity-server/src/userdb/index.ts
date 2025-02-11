import { type TwakeLogger } from '@twake/logger'
import type Cache from '../cache'
import { type Config, type DbGetResult } from '../types'
import UserDBEmpty from './empty'
import UserDBLDAP from './ldap'
import UserDBPg from './sql/pg'
import UserDBSQLite from './sql/sqlite'

export type SupportedUserDatabases =
  | 'sqlite'
  | 'pg'
  | 'ldap'
  | ''
  | null
  | undefined

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

  constructor(
    conf: Config,
    private readonly logger: TwakeLogger,
    cache?: Cache
  ) {
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
      case null:
      case undefined:
      case '': {
        Module = UserDBEmpty
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
    console.log('UserDB: getAll')
    if (typeof order !== 'string' || !/^[\w-]+$/.test(order)) order = undefined
    if (this.cache != null) {
      console.log('UserDB: getAll: using cache')
      return new Promise((resolve, reject) => {
        let key: string = [table, ...fields].join(',')
        if (order != null) key += `_${order}`
        ;(this.cache as Cache)
          .get(key)
          .then((data) => {
            console.log('UserDB: getAll: cached value:', data)
            if (data == null) throw new Error()
            resolve(data)
          })
          .catch(() => {
            console.log('UserDB: getAll: cache error, calling DB')
            this.db
              .getAll(table, fields, order)
              .then((res) => {
                console.log(
                  'UserDB: getAll: DB result:',
                  res,
                  '| setting cache and leave'
                )
                ;(this.cache as Cache).set(key, res).catch(this.logger.error)
                resolve(res)
              })
              .catch(reject)
          })
      })
    } else {
      console.log('UserDB: getAll: no cache')
      return this.db.getAll(table, fields, order)
    }
  }

  close(): void {
    this.db.close()
  }
}

export default UserDB
