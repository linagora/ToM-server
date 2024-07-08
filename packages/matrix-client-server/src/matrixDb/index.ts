import { type TwakeLogger } from '@twake/logger'
import { type Config, type DbGetResult } from '../types'
import MatrixDBPg from './sql/pg'
import MatrixDBSQLite from './sql/sqlite'

export type Collections =
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
  | 'user_ips'
  | 'registration_tokens'
  | 'account_data'
  | 'devices'
  | 'local_current_membership'
  | 'room_account_data'

type Get = (
  table: Collections,
  fields?: string[],
  filterFields?: Record<string, string | number | Array<string | number>>
) => Promise<DbGetResult>

type GetAll = (table: Collections, fields: string[]) => Promise<DbGetResult>

type Insert = (
  table: Collections,
  values: Record<string, string | number>
) => Promise<DbGetResult>
type updateWithConditions = (
  table: Collections,
  values: Record<string, string | number>,
  conditions: Array<{ field: string; value: string | number }>
) => Promise<DbGetResult>
type DeleteEqual = (
  table: Collections,
  field: string,
  value: string | number
) => Promise<void>

export interface MatrixDBmodifiedBackend {
  ready: Promise<void>
  get: Get
  getAll: GetAll
  insert: Insert
  deleteEqual: DeleteEqual
  updateWithConditions: updateWithConditions
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
  deleteEqual(table: Collections, field: string, value: string | number) {
    return this.db.deleteEqual(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  updateWithConditions(
    table: Collections,
    values: Record<string, string | number>,
    conditions: Array<{ field: string; value: string | number }>
  ) {
    return this.db.updateWithConditions(table, values, conditions)
  }

  close(): void {
    this.db.close()
  }
}

export default MatrixDBmodified
