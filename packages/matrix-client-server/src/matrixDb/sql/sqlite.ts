import { type Collections } from '../../../../matrix-identity-server/src/db'
import { type MatrixDBmodifiedBackend } from '../'
import { type Config } from '../../types'
import SQLite from '../../../../matrix-identity-server/src/db/sql/sqlite'

class MatrixDBSQLite extends SQLite<string> implements MatrixDBmodifiedBackend {
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(
    conf: Config,
    tables: Record<Collections, string>,
    indexes: Partial<Record<Collections, string[]>>,
    initializeValues: Partial<
      Record<Collections, Array<Record<string, string | number>>>
    >
  ): Promise<void> {
    if (this.db != null) return Promise.resolve()
    return new Promise((resolve, reject) => {
      import('sqlite3')
        .then((sqlite3) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
          /* istanbul ignore next */ // @ts-ignore
          if (sqlite3.Database == null) sqlite3 = sqlite3.default
          const db = (this.db = new sqlite3.Database(
            conf.matrix_database_host as string,
            sqlite3.OPEN_READONLY
          ))
          /* istanbul ignore if */
          if (db == null) {
            reject(new Error('Database not created'))
          }
          resolve()
        })
        .catch((e) => {
          /* istanbul ignore next */
          reject(e)
        })
    })
  }
}

export default MatrixDBSQLite
