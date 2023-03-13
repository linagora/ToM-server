import { type Config } from '..'
import { randomString } from '../utils/tokenUtils'
import Sqlite from './sql/sqlite'

export const cleanByExpires = [
  'oneTimeTokens',
  'attempts'
]

export type SupportedDatabases = 'sqlite' | 'pg'

type Insert = (table: string, values: Array<string | number>) => Promise<void>
type Get = (table: string, field: string, value: string | number) => Promise<Array<Record<string, string | number >>>
type DeleteEqual = (table: string, field: string, value: string | number) => Promise<void>
type DeleteLowerThan = (table: string, field: string, value: string | number) => Promise<void>

export interface IdDbBackend {
  ready: Promise<boolean>
  createDatabases: (conf: Config) => Promise<boolean>
  insert: Insert
  get: Get
  deleteEqual: DeleteEqual
  deleteLowerThan: DeleteLowerThan
}
export type InsertType = (table: string, values: Array<string | number>) => Promise<void>

class IdentityServerDb implements IdDbBackend {
  ready: Promise<boolean>
  db: IdDbBackend
  cleanJob?: NodeJS.Timeout
  constructor (conf: Config) {
    let Module
    switch (conf.database_engine) {
      case 'sqlite': {
        Module = Sqlite
        break
      }
      default: {
        /* istanbul ignore next */
        throw new Error(`Unsupported database type ${conf.database_engine}`)
      }
    }
    this.db = new Module(conf)
    this.ready = this.db.ready
    this.ready.then(() => {
      this.dbMaintenance(conf.database_vacuum_delay)
    }).catch(e => {
      /* istanbul ignore next */
      console.error('DB maintenance error', e)
    })
  }

  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases (conf: Config): Promise<boolean> {
    throw new Error('Must be overidden')
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  insert (table: string, values: Array<string | number>) {
    return this.db.insert(table, values)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  get (table: string, field: string, value: string | number) {
    return this.db.get(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteEqual (table: string, field: string, value: string | number) {
    return this.db.deleteEqual(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteLowerThan (table: string, field: string, value: string | number) {
    return this.db.deleteLowerThan(table, field, value)
  }

  createOneTimeToken (data: object, expires?: number): string {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    const id = randomString(64)
    // default: expires in 600 s
    expires ||= Math.floor(Date.now() / 1000 + 600)
    this.db.insert('oneTimeTokens', [id, expires, JSON.stringify(data)]).catch(err => {
      /* istanbul ignore next */
      console.error('Failed to insert token', err)
    })
    return id
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  verifyOneTimeToken (id: string): Promise<object> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db.get('oneTimeTokens', 'id', id).then((rows) => {
        this.db.deleteEqual('oneTimeTokens', 'id', id).catch((e: any) => { console.error(e) })
        resolve(JSON.parse(rows[0].data as string))
      }).catch(e => {
        reject(e)
      })
    })
  }

  dbMaintenance (delay: number): void {
    const _vacuum = (): void => {
      /* istanbul ignore next */
      cleanByExpires.forEach(table => {
        void this.deleteLowerThan(table, 'expires', Math.floor(Date.now() / 1000))
      })
      /* istanbul ignore next */
      this.cleanJob = setTimeout(_vacuum, delay)
    }
    this.cleanJob = setTimeout(_vacuum, delay)
  }
}

export default IdentityServerDb
