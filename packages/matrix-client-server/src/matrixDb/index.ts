import { type TwakeLogger } from '@twake/logger'
import { type Config, type DbGetResult } from '../types'
import { type ISQLCondition } from '@twake/matrix-identity-server/src/db'
import MatrixDBPg from './sql/pg'
import MatrixDBSQLite from './sql/sqlite'

type Collections =
  | 'users'
  | 'profiles'
  | 'destinations'
  | 'events'
  | 'state_events'
  | 'current_state_events'
  | 'room_memberships'
  | 'rooms'
  | 'server_signature_keys'
  | 'rejections'
  | 'event_forward_extremities'
  | 'event_backward_extremities'
  | 'room_depth'
  | 'local_media_repository'
  | 'redactions'
  | 'room_aliases'
  | 'threepid_guest_access_tokens'

type Get = (
  table: Collections,
  fields?: string[],
  filterFields?: Record<string, string | number | Array<string | number>>
) => Promise<DbGetResult>
/*
  type Match = (
    table: Collections,
    fields: string[],
    searchFields: string[],
    value: string | number
  ) => Promise<DbGetResult>
  */
type GetAll = (table: Collections, fields: string[]) => Promise<DbGetResult>

type Insert = (
  table: Collections,
  values: Record<string, string | number>
) => Promise<DbGetResult>
type Update = (
  table: Collections,
  values: Record<string, string | number>,
  field: string,
  value: string | number
) => Promise<DbGetResult>
type DeleteEqual = (
  table: Collections,
  field: string,
  value: string | number
) => Promise<void>
type DeleteWhere = (
  table: string,
  conditions: ISQLCondition | ISQLCondition[]
) => Promise<void>

export interface MatrixDBmodifiedBackend {
  ready: Promise<void>
  get: Get
  getAll: GetAll
  insert: Insert
  deleteEqual: DeleteEqual
  deleteWhere: DeleteWhere
  update: Update
  // match: Match
  close: () => void
}

class MatrixDBmodified implements MatrixDBmodifiedBackend {
  ready: Promise<void>
  db: MatrixDBmodifiedBackend

  constructor(conf: Config, private readonly logger: TwakeLogger) {
    let Module
    /* istanbul ignore next */
    switch (conf.matrix_database_engine) {
      case 'sqlite': {
        Module = MatrixDBSQLite
        break
      }
      case 'pg': {
        Module = MatrixDBPg
        break
      }
      default: {
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Unsupported matrix-database type ${conf.matrix_database_engine}`
        )
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
  getAll(table: Collections, fields: string[]) {
    return this.db.getAll(table, fields)
  }

  get = async (
    table: Collections,
    fields?: string[],
    filterFields?: Record<string, string | number | Array<string | number>>
  ): Promise<DbGetResult> => {
    return await this.db.get(table, fields, filterFields)
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
  deleteEqual(table: Collections, field: string, value: string | number) {
    return this.db.deleteEqual(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteWhere(table: string, conditions: ISQLCondition | ISQLCondition[]) {
    // Deletes from table where filters correspond to values
    // Size of filters and values must be the same
    return this.db.deleteWhere(table, conditions)
  }

  close(): void {
    this.db.close()
  }
}

export default MatrixDBmodified