import { type Collections, type MatrixDBBackend } from '../index.ts'
import SQLite from '../../db/sql/sqlite.ts'
import { type Config } from '../../types.ts'

class MatrixDBSQLite extends SQLite<Collections> implements MatrixDBBackend {
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  override createDatabases(
    conf: Config,
    tables: Record<Collections, string>,
    indexes: Partial<Record<Collections, string[]>>,
    initializeValues: Partial<
      Record<Collections, Array<Record<string, string | number>>>
    >
  ): Promise<void> {
    if (this.db != null) {
      this.logger.debug(
        '[MatrixDBSQLite][createDatabases] Database already initialized'
      )
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      this.logger.debug(
        '[MatrixDBSQLite][createDatabases] Initializing database connection',
        {
          path: conf.matrix_database_host
        }
      )
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
            this.logger.error(
              '[MatrixDBSQLite][createDatabases] Database not created',
              {
                path: conf.matrix_database_host
              }
            )
            reject(new Error('Database not created'))
          } else {
            this.logger.info(
              'MatrixDB SQLite database connection established',
              { path: conf.matrix_database_host }
            )
            resolve()
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          this.logger.error(
            '[MatrixDBSQLite][createDatabases] Unable to load sqlite3 module',
            {
              error: e
            }
          )
          reject(e)
        })
    })
  }
}

export default MatrixDBSQLite
