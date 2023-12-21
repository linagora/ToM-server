import { type TwakeLogger } from '@twake/logger'
import { type Config, type DbGetResult } from '../types'
import MatrixDBPg from './sql/pg'
import MatrixDBSQLite from './sql/sqlite'

type Collections =
  | 'users'
  | 'room_memberships'
  | 'room_stats_state'
  | 'local_media_repository'
  | 'room_aliases'

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

export interface MatrixDBBackend {
  ready: Promise<void>
  get: Get
  getAll: GetAll
  // match: Match
  close: () => void
}

class MatrixDB implements MatrixDBBackend {
  ready: Promise<void>
  db: MatrixDBBackend
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
          // TODO: insert here init if needed
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

  close(): void {
    this.db.close()
  }
}

export default MatrixDB
