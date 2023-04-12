import { type UserDBBackend } from '..'
import { type Config } from '../..'
import SQLite from '../../db/sql/sqlite'

class UserDBSQLite extends SQLite implements UserDBBackend {
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases (conf: Config): Promise<boolean> {
    return new Promise((resolve, reject) => {
      import('sqlite3').then(sqlite3 => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore
        if (sqlite3.Database == null) sqlite3 = sqlite3.default
        const db = this.db = new sqlite3.Database(conf.database_host)
        /* istanbul ignore if */
        if (db == null) {
          reject(new Error('Database not created'))
        }
        resolve(true)
      }).catch(e => {
        /* istanbul ignore next */
        reject(e)
      })
    })
  }
}

export default UserDBSQLite
