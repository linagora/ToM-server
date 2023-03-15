import { type Config } from '..'
import { randomString } from '../utils/tokenUtils'
import Sqlite from './sql/sqlite'

export type SupportedDatabases = 'sqlite' | 'pg'

export type Collections = 'accessTokens' | 'oneTimeTokens' | 'attempts'

export const cleanByExpires: Collections[] = [
  'oneTimeTokens',
  'attempts'
]

type Insert = (table: Collections, values: Record<string, string | number>) => Promise<void>
type Get = (table: Collections, fields: string[], field: string, value: string | number) => Promise<Array<Record<string, string | number >>>
type DeleteEqual = (table: Collections, field: string, value: string | number) => Promise<void>
type DeleteLowerThan = (table: Collections, field: string, value: string | number) => Promise<void>

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
    /* istanbul ignore next */
    switch (conf.database_engine) {
      case 'sqlite': {
        Module = Sqlite
        break
      }
      default: {
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
  insert (table: Collections, values: Record<string, string | number>) {
    return this.db.insert(table, values)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  get (table: Collections, fields: string[], field: string, value: string | number) {
    return this.db.get(table, fields, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteEqual (table: Collections, field: string, value: string | number) {
    return this.db.deleteEqual(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteLowerThan (table: Collections, field: string, value: string | number) {
    return this.db.deleteLowerThan(table, field, value)
  }

  createOneTimeToken (data: object, expires?: number): string {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    const id = randomString(64)
    // default: expires in 600 s
    expires = Math.floor(Date.now() / 1000 + (expires != null ? expires : 600))
    this.db.insert('oneTimeTokens', { id, expires, data: JSON.stringify(data) }).catch(err => {
      /* istanbul ignore next */
      console.error('Failed to insert token', err)
    })
    return id
  }

  // No difference in creation between a token and a one-time-token
  createToken (data: object, expires?: number): string {
    return this.createOneTimeToken(data, expires)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  verifyToken (id: string): Promise<object> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db.get('oneTimeTokens', ['data', 'expires'], 'id', id).then((rows) => {
        /* istanbul ignore else */
        if ((rows[0].expires as number) >= Math.floor(Date.now() / 1000)) {
          resolve(JSON.parse(rows[0].data as string))
        } else {
          console.error(rows)
          reject(new Error('Token expired' + (rows[0].expires as number).toString()))
        }
      }).catch(e => {
        reject(e)
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  verifyOneTimeToken (id: string): Promise<object> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.verifyToken(id).then((data) => {
        void this.deleteToken(id)
        resolve(data)
      }).catch(e => {
        reject(e)
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteToken (id: string): Promise<void> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db.deleteEqual('oneTimeTokens', 'id', id).then((e: any) => {
        /* istanbul ignore if */
        if (e != null) console.error(e)
        resolve()
      }).catch(e => {
        /* istanbul ignore next */
        console.error(`Token ${id} already deleted`, e)
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
      this.cleanJob = setTimeout(_vacuum, delay * 1000)
    }
    this.cleanJob = setTimeout(_vacuum, delay * 1000)
  }
}

export default IdentityServerDb
