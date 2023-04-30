import { type PgDatabase } from './pg'
import { type Collections } from '..'
import { type SQLiteDatabase } from './sqlite'
import { type Config } from '../..'

export type CreateDbMethod = (
  conf: Config,
  tables: Record<Collections, string>,
  indexes: Partial<Record<Collections, string[]>>,
  initializeValues: Partial<
    Record<Collections, Array<Record<string, string | number>>>
  >
) => Promise<void>

const tables: Record<Collections, string> = {
  accessTokens: 'id varchar(64) PRIMARY KEY, data text',
  oneTimeTokens: 'id varchar(64) PRIMARY KEY, expires int, data text',
  attempts: 'email text PRIMARY KEY, expires int, attempt int',
  keys: 'name varchar(32) PRIMARY KEY, data text',
  hashes:
    'hash varchar(48) PRIMARY KEY, pepper varchar(32), type varchar(8), value text, active integer'
}

const indexes: Partial<Record<Collections, string[]>> = {
  oneTimeTokens: ['expires'],
  attempts: ['expires']
}

const initializeValues: Partial<
  Record<Collections, Array<Record<string, string | number>>>
> = {
  keys: [
    { name: 'pepper', data: '' },
    { name: 'previousPepper', data: '' }
  ]
}

abstract class SQL {
  db?: SQLiteDatabase | PgDatabase
  ready: Promise<void>
  cleanJob?: NodeJS.Timeout

  constructor(conf: Config) {
    // @ts-expect-error method is defined in child class
    this.ready = this.createDatabases(conf, tables, indexes, initializeValues)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getCount(
    table: Collections,
    field: string,
    value?: string | number | string[]
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      // @ts-expect-error implemented later
      this.get(table, [`count(${field}) as count`], field, value)
        .then((rows: Array<Record<string, string>>) => {
          resolve(parseInt(rows[0].count))
        })
        .catch((e: any) => {
          /* istanbul ignore next */
          reject(e)
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getAll(
    table: string,
    fields: string[]
  ): Promise<Array<Record<string, string | number>>> {
    // @ts-expect-error implemented later
    return this.get(table, fields)
  }
}

export default SQL
