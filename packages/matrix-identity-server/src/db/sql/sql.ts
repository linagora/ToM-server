import { type TwakeLogger } from '@twake/logger'
import { type Collections } from '..'
import { type Config, type DbGetResult } from '../../types'
import { type PgDatabase } from './pg'
import { type SQLiteDatabase } from './sqlite'

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
    'hash varchar(48) PRIMARY KEY, pepper varchar(32), type varchar(8), value text, active integer',
  privateNotes:
    'id varchar(64) PRIMARY KEY, authorId varchar(64), content text, targetId varchar(64)',
  roomTags:
    'id varchar(64) PRIMARY KEY, authorId varchar(64), content text, roomId varchar(64)',
  userHistory: 'address text PRIMARY KEY, active integer, timestamp integer',
  userQuotas: 'user_id varchar(64) PRIMARY KEY, size int'
}

const indexes: Partial<Record<Collections, string[]>> = {
  oneTimeTokens: ['expires'],
  attempts: ['expires'],
  userHistory: ['timestamp']
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

  constructor(conf: Config, logger: TwakeLogger) {
    // @ts-expect-error method is defined in child class
    this.ready = this.createDatabases(
      conf,
      tables,
      indexes,
      initializeValues,
      logger
    )
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getCount(
    table: Collections,
    field: string,
    value?: string | number | string[]
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const args: any[] = [table, [`count(${field}) as count`]]
      if (value != null) args.push({ [field]: value })
      // @ts-expect-error implemented later
      this.get(...args)
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
    fields: string[],
    order?: string
  ): Promise<DbGetResult> {
    // @ts-expect-error implemented later
    return this.get(table, fields, undefined, order)
  }
}

export default SQL
