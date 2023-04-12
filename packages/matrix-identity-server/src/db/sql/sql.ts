// import { type PgDatabase } from './pg'
import { type Collections } from '..'
import { type Config } from '../..'
import { type SQLiteDatabase } from './sqlite'

export const tables: Record<Collections, string> = {
  accessTokens: 'id varchar(64) primary key, data text',
  oneTimeTokens: 'id varchar(64) primary key, expires int, data text',
  attempts: 'email primary key, expires int, attempt int',
  keys: 'name varchar(32) primary key, data text',
  hashes: 'hash varchar(32) primary key, pepper varchar(32), type varchar(8), value text'
}

export const indexes: Partial<Record<Collections, string[]>> = {
  oneTimeTokens: ['expires'],
  attempts: ['expires']
}

abstract class SQL {
  db?: SQLiteDatabase // | PgDatabase
  ready: Promise<void>
  cleanJob?: NodeJS.Timeout

  constructor (conf: Config) {
    // @ts-expect-error method is defined in child class
    this.ready = this.createDatabases(conf)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getCount (table: Collections, field: string, value?: string | number | string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      // @ts-expect-error implemented later
      this.get(table, [`count(${field})`], field, value).then(rows => {
        resolve(rows[0][`count(${field})`] as number)
      }).catch((e: any) => {
        /* istanbul ignore next */
        reject(e)
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getAll (table: string, fields: string[]): Promise<Array<Record<string, string | number >>> {
    // @ts-expect-error implemented later
    return this.get(table, fields)
  }
}

export default SQL
