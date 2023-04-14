import { type Config } from '..'
import { randomString } from '../utils/tokenUtils'
import Pg from './sql/pg'
import Sqlite from './sql/sqlite'

export type SupportedDatabases = 'sqlite' | 'pg'

export type Collections =
  | 'accessTokens'
  | 'oneTimeTokens'
  | 'attempts'
  | 'keys'
  | 'hashes'

export const cleanByExpires: Collections[] = ['oneTimeTokens', 'attempts']

type Insert = (
  table: Collections,
  values: Record<string, string | number>
) => Promise<void>
type Update = (
  table: Collections,
  values: Record<string, string | number>,
  field: string,
  value: string | number
) => Promise<void>
type Get = (
  table: Collections,
  fields: string[],
  field: string,
  value: string | number | string[]
) => Promise<Array<Record<string, string | number>>>
type GetCount = (
  table: Collections,
  field: string,
  value?: string | number | string[]
) => Promise<number>
type Match = (
  table: Collections,
  fields: string[],
  searchFields: string[],
  value: string | number
) => Promise<Array<Record<string, string | string[] | number>>>
type DeleteEqual = (
  table: Collections,
  field: string,
  value: string | number
) => Promise<void>
type DeleteLowerThan = (
  table: Collections,
  field: string,
  value: string | number
) => Promise<void>

export interface IdDbBackend {
  ready: Promise<void>
  createDatabases: (conf: Config) => Promise<boolean>
  insert: Insert
  get: Get
  getCount: GetCount
  match: Match
  update: Update
  deleteEqual: DeleteEqual
  deleteLowerThan: DeleteLowerThan
  close: () => void
}
export type InsertType = (
  table: string,
  values: Array<string | number>
) => Promise<void>

class IdentityServerDb implements IdDbBackend {
  ready: Promise<void>
  db: IdDbBackend
  cleanJob?: NodeJS.Timeout
  constructor(conf: Config) {
    let Module
    /* istanbul ignore next */
    switch (conf.database_engine) {
      case 'sqlite': {
        Module = Sqlite
        break
      }
      case 'pg': {
        Module = Pg
        break
      }
      default: {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Unsupported database type ${conf.database_engine}`)
      }
    }
    this.db = new Module(conf)
    this.ready = new Promise((resolve, reject) => {
      this.db.ready
        .then(() => {
          this.init()
            .then(() => {
              resolve()
            })
            .catch((e) => {
              /* istanbul ignore next */
              console.error('initialization failed')
              /* istanbul ignore next */
              reject(e)
            })
        })
        .catch((e) => {
          /* istanbul ignore next */
          console.error('Database initialization failed')
          /* istanbul ignore next */
          reject(e)
        })
    })
    this.ready
      .then(() => {
        this.dbMaintenance(conf.database_vacuum_delay)
      })
      .catch((e) => {
        /* istanbul ignore next */
        console.error('DB maintenance error', e)
      })
  }

  // For later
  async init(): Promise<void> {}

  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(conf: Config): Promise<boolean> {
    throw new Error('Must be overidden')
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  insert(table: Collections, values: Record<string, string | number>) {
    return this.db.insert(table, values)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  update(
    table: Collections,
    values: Record<string, string | number>,
    field: string,
    value: string | number
  ) {
    return this.db.update(table, values, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  get(
    table: Collections,
    fields: string[],
    field: string,
    value: string | number | string[]
  ) {
    return this.db.get(table, fields, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getCount(
    table: Collections,
    field: string,
    value?: string | number | string[]
  ) {
    return this.db.getCount(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  match(
    table: Collections,
    fields: string[],
    searchFields: string[],
    value: string | number
  ) {
    return this.db.match(table, fields, searchFields, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteEqual(table: Collections, field: string, value: string | number) {
    return this.db.deleteEqual(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteLowerThan(table: Collections, field: string, value: string | number) {
    return this.db.deleteLowerThan(table, field, value)
  }

  createOneTimeToken(data: object, expires?: number): string {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    const id = randomString(64)
    // default: expires in 600 s
    expires = Math.floor(Date.now() / 1000 + (expires != null ? expires : 600))
    this.db
      .insert('oneTimeTokens', { id, expires, data: JSON.stringify(data) })
      .catch((err) => {
        /* istanbul ignore next */
        console.error('Failed to insert token', err)
      })
    return id
  }

  // No difference in creation between a token and a one-time-token
  createToken(data: object, expires?: number): string {
    return this.createOneTimeToken(data, expires)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  verifyToken(id: string): Promise<object> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db
        .get('oneTimeTokens', ['data', 'expires'], 'id', id)
        .then((rows) => {
          /* istanbul ignore else */
          if (
            rows.length > 0 &&
            (rows[0].expires as number) >= Math.floor(Date.now() / 1000)
          ) {
            resolve(JSON.parse(rows[0].data as string))
          } else {
            reject(
              new Error(
                'Token expired' + (rows[0].expires as number).toString()
              )
            )
          }
        })
        .catch((e) => {
          reject(e)
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  verifyOneTimeToken(id: string): Promise<object> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.verifyToken(id)
        .then((data) => {
          void this.deleteToken(id)
          resolve(data)
        })
        .catch((e) => {
          reject(e)
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteToken(id: string): Promise<void> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db
        .deleteEqual('oneTimeTokens', 'id', id)
        .then(() => {
          resolve()
        })
        .catch((e) => {
          /* istanbul ignore next */
          console.info(`Token ${id} already deleted`, e)
          /* istanbul ignore next */
          resolve()
        })
    })
  }

  dbMaintenance(delay: number): void {
    const _vacuum = (): void => {
      /* istanbul ignore next */
      cleanByExpires.forEach((table) => {
        void this.deleteLowerThan(
          table,
          'expires',
          Math.floor(Date.now() / 1000)
        )
      })
      /* istanbul ignore next */
      this.cleanJob = setTimeout(_vacuum, delay * 1000)
    }
    this.cleanJob = setTimeout(_vacuum, delay * 1000)
  }

  close(): void {
    this.db.close()
  }
}

export default IdentityServerDb
