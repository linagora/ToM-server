import { type Config } from '..'
import MatrixDBPg from './sql/pg'
import MatrixDBSQLite from './sql/sqlite'

type Collections = 'users'

type Get = (
  table: Collections,
  fields?: string[],
  field?: string,
  value?: string | number
) => Promise<Array<Record<string, string | string[] | number>>>
type GetAll = (
  table: Collections,
  fields: string[]
) => Promise<Array<Record<string, string | string[] | number>>>
type Match = (
  table: Collections,
  fields: string[],
  searchFields: string[],
  value: string | number
) => Promise<Array<Record<string, string | string[] | number>>>

export interface MatrixDBBackend {
  ready: Promise<void>
  get: Get
  getAll: GetAll
  match: Match
}

class MatrixDB implements MatrixDBBackend {
  ready: Promise<void>
  db: MatrixDBBackend

  constructor(conf: Config) {
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
          `Unsupported database type ${conf.matrix_database_engine}`
        )
      }
    }
    this.db = new Module(conf)
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
  get(
    table: Collections,
    fields?: string[],
    field?: string,
    value?: string | number
  ) {
    return this.db.get(table, fields, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  match(
    table: Collections,
    fields: string[],
    searchFields: string[],
    value: string | number
  ) {
    return this.db.match(table, fields, searchFields, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getAll(table: Collections, fields: string[]) {
    return this.db.getAll(table, fields)
  }
}

export default MatrixDB
