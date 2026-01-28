import { type ConnectionOptions } from 'tls'

export type SupportedDatabases = 'sqlite' | 'pg'

export interface DatabaseConfig {
  database_engine: SupportedDatabases
  database_host: string
  database_name?: string
  database_user?: string
  database_password?: string
  database_ssl?: boolean | ConnectionOptions
  database_vacuum_delay: number
}

export type DbGetResult = Array<
  Record<string, string | number | Array<string | number>>
>

export type SqlComparaisonOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | '<>'

export interface ISQLCondition {
  field: string
  operator: SqlComparaisonOperator
  value: string | number
}

type Insert<T> = (
  table: T,
  values: Record<string, string | number>
) => Promise<DbGetResult>

type Update<T> = (
  table: T,
  values: Record<string, string | number>,
  field: string,
  value: string | number
) => Promise<DbGetResult>

type UpdateAnd<T> = (
  table: T,
  values: Record<string, string | number>,
  condition1: { field: string; value: string | number },
  condition2: { field: string; value: string | number }
) => Promise<DbGetResult>

type Get<T> = (
  table: T,
  fields: string[],
  filterFields: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>

type Get2<T> = (
  table: T,
  fields: string[],
  filterFields1: Record<string, string | number | Array<string | number>>,
  filterFields2: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>

type GetJoin<T> = (
  tables: T[],
  fields: string[],
  filterFields: Record<string, string | number | Array<string | number>>,
  joinFields: Record<string, string>,
  order?: string
) => Promise<DbGetResult>

type GetMinMax<T> = (
  table: T,
  targetField: string,
  fields: string[],
  filterFields: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>

type GetMinMax2<T> = (
  table: T,
  targetField: string,
  fields: string[],
  filterFields1: Record<string, string | number | Array<string | number>>,
  filterFields2: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>

type GetMinMaxJoin2<T> = (
  tables: T[],
  targetField: string,
  fields: string[],
  filterFields1: Record<string, string | number | Array<string | number>>,
  filterFields2: Record<string, string | number | Array<string | number>>,
  joinFields: Record<string, string>,
  order?: string
) => Promise<DbGetResult>

type GetCount<T> = (
  table: T,
  field: string,
  value?: string | number | string[]
) => Promise<number>

type GetAll<T> = (
  table: T,
  fields: string[],
  order?: string
) => Promise<DbGetResult>

type Match<T> = (
  table: T,
  fields: string[],
  searchFields: string[],
  value: string | number
) => Promise<DbGetResult>

type DeleteEqual<T> = (
  table: T,
  field: string,
  value: string | number
) => Promise<void>

type DeleteEqualAnd<T> = (
  table: T,
  condition1: {
    field: string
    value: string | number | Array<string | number>
  },
  condition2: { field: string; value: string | number | Array<string | number> }
) => Promise<void>

type DeleteLowerThan<T> = (
  table: T,
  field: string,
  value: string | number
) => Promise<void>

type DeleteWhere<T> = (
  table: T,
  conditions: ISQLCondition | ISQLCondition[]
) => Promise<void>

export interface DbBackend<T> {
  ready: Promise<void>
  createDatabases: (conf: DatabaseConfig, ...args: any) => Promise<void>
  insert: Insert<T>
  get: Get<T>
  getJoin: GetJoin<T>
  getWhereEqualOrDifferent: Get2<T>
  getWhereEqualAndHigher: Get2<T>
  getMaxWhereEqual: GetMinMax<T>
  getMaxWhereEqualAndLower: GetMinMax2<T>
  getMinWhereEqualAndHigher: GetMinMax2<T>
  getMaxWhereEqualAndLowerJoin: GetMinMaxJoin2<T>
  getCount: GetCount<T>
  getAll: GetAll<T>
  getHigherThan: Get<T>
  match: Match<T>
  update: Update<T>
  updateAnd: UpdateAnd<T>
  deleteEqual: DeleteEqual<T>
  deleteEqualAnd: DeleteEqualAnd<T>
  deleteLowerThan: DeleteLowerThan<T>
  deleteWhere: DeleteWhere<T>
  close: () => void
}
