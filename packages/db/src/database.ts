import { type TwakeLogger } from '@twake/logger'
import {
  type DatabaseConfig,
  type DbGetResult,
  type DbBackend,
  type ISQLCondition,
  type ColumnDefinition,
  type ColumnInfo
} from './types'
import Pg from './sql/pg'
import SQLite from './sql/sqlite'

/**
 * Generic Database class that provides a unified interface for SQLite and PostgreSQL
 * This class is database-agnostic and does not include any predefined tables or business logic.
 *
 * @template T - Union type of table names (e.g., 'users' | 'settings')
 */
class Database<T extends string> implements DbBackend<T> {
  ready: Promise<void>
  private readonly db: DbBackend<T>
  private readonly logger: TwakeLogger

  constructor(
    conf: DatabaseConfig,
    logger: TwakeLogger,
    tables: Record<T, string>,
    indexes?: Partial<Record<T, string[]>>,
    initializeValues?: Partial<
      Record<T, Array<Record<string, string | number>>>
    >
  ) {
    this.logger = logger

    let Module: typeof SQLite | typeof Pg
    switch (conf.database_engine) {
      case 'sqlite': {
        Module = SQLite
        break
      }
      case 'pg': {
        Module = Pg
        break
      }
      default: {
        throw new Error(`Unsupported database type ${conf.database_engine}`)
      }
    }

    this.db = new Module<T>(
      conf,
      logger,
      tables,
      indexes ?? {},
      initializeValues ?? {}
    )

    this.ready = new Promise((resolve, reject) => {
      this.db.ready
        .then(() => {
          this.logger.info('[Database] initialized.')
          resolve()
        })
        .catch((e) => {
          this.logger.error('[Database] initialization failed', e)
          reject(e)
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(conf: DatabaseConfig, ...args: any): Promise<void> {
    return this.db.createDatabases(conf, ...args)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  insert(
    table: T,
    values: Record<string, string | number>
  ): Promise<DbGetResult> {
    return this.db.insert(table, values)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  update(
    table: T,
    values: Record<string, string | number>,
    field: string,
    value: string | number
  ): Promise<DbGetResult> {
    return this.db.update(table, values, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  updateAnd(
    table: T,
    values: Record<string, string | number>,
    condition1: { field: string; value: string | number },
    condition2: { field: string; value: string | number }
  ): Promise<DbGetResult> {
    return this.db.updateAnd(table, values, condition1, condition2)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  get(
    table: T,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.get(table, fields, filterFields, order)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getJoin(
    tables: T[],
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    joinFields: Record<string, string>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.getJoin(tables, fields, filterFields, joinFields, order)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getWhereEqualOrDifferent(
    table: T,
    fields: string[],
    filterFields1: Record<string, string | number | Array<string | number>>,
    filterFields2: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.getWhereEqualOrDifferent(
      table,
      fields,
      filterFields1,
      filterFields2,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getWhereEqualAndHigher(
    table: T,
    fields: string[],
    filterFields1: Record<string, string | number | Array<string | number>>,
    filterFields2: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.getWhereEqualAndHigher(
      table,
      fields,
      filterFields1,
      filterFields2,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getMaxWhereEqual(
    table: T,
    targetField: string,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.getMaxWhereEqual(
      table,
      targetField,
      fields,
      filterFields,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getMaxWhereEqualAndLower(
    table: T,
    targetField: string,
    fields: string[],
    filterFields1: Record<string, string | number | Array<string | number>>,
    filterFields2: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.getMaxWhereEqualAndLower(
      table,
      targetField,
      fields,
      filterFields1,
      filterFields2,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getMinWhereEqualAndHigher(
    table: T,
    targetField: string,
    fields: string[],
    filterFields1: Record<string, string | number | Array<string | number>>,
    filterFields2: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.getMinWhereEqualAndHigher(
      table,
      targetField,
      fields,
      filterFields1,
      filterFields2,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getMaxWhereEqualAndLowerJoin(
    tables: T[],
    targetField: string,
    fields: string[],
    filterFields1: Record<string, string | number | Array<string | number>>,
    filterFields2: Record<string, string | number | Array<string | number>>,
    joinFields: Record<string, string>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.getMaxWhereEqualAndLowerJoin(
      tables,
      targetField,
      fields,
      filterFields1,
      filterFields2,
      joinFields,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getCount(
    table: T,
    field: string,
    value?: string | number | string[]
  ): Promise<number> {
    return this.db.getCount(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getAll(table: T, fields: string[], order?: string): Promise<DbGetResult> {
    return this.db.getAll(table, fields, order)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getHigherThan(
    table: T,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.getHigherThan(table, fields, filterFields, order)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  match(
    table: T,
    fields: string[],
    searchFields: string[],
    value: string | number
  ): Promise<DbGetResult> {
    return this.db.match(table, fields, searchFields, value)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteEqual(table: T, field: string, value: string | number): Promise<void> {
    return this.db.deleteEqual(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteEqualAnd(
    table: T,
    condition1: {
      field: string
      value: string | number | Array<string | number>
    },
    condition2: {
      field: string
      value: string | number | Array<string | number>
    }
  ): Promise<void> {
    return this.db.deleteEqualAnd(table, condition1, condition2)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteLowerThan(
    table: T,
    field: string,
    value: string | number
  ): Promise<void> {
    return this.db.deleteLowerThan(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteWhere(
    table: T,
    conditions: ISQLCondition | ISQLCondition[]
  ): Promise<void> {
    return this.db.deleteWhere(table, conditions)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getTableColumns(table: T): Promise<ColumnInfo[]> {
    return this.db.getTableColumns(table)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  addColumn(table: T, column: ColumnDefinition): Promise<void> {
    return this.db.addColumn(table, column)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  ensureColumns(table: T, columns: ColumnDefinition[]): Promise<void> {
    return this.db.ensureColumns(table, columns)
  }

  close(): void {
    this.db.close()
  }
}

export default Database
