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

type sqlComparaisonOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | '<>'

export interface ISQLCondition {
  field: string
  operator: sqlComparaisonOperator
  value: string | number
}

abstract class SQL<T extends string> {
  db?: SQLiteDatabase | PgDatabase
  ready: Promise<void>
  cleanJob?: NodeJS.Timeout

  constructor(
    conf: Config,
    private readonly logger: TwakeLogger,
    tables?: Record<T, string>,
    indexes?: Partial<Record<T, string[]>>,
    initializeValues?: Partial<
      Record<T, Array<Record<string, string | number>>>
    >
  ) {
    // @ts-expect-error method is defined in child class
    this.ready = this.createDatabases(
      conf,
      tables,
      indexes,
      initializeValues,
      this.logger
    )
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getCount(
    table: T,
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
  getAll(table: T, fields: string[], order?: string): Promise<DbGetResult> {
    // @ts-expect-error implemented later
    return this.get(table, fields, undefined, order)
  }
}

export default SQL
