import { recoveryWordsSQL } from './sql'
import { type VaultDbBackend } from '../utils'
import { SQLite } from '@twake/matrix-identity-server'
import { type Config } from '../../utils'

export class VaultDBSQLite
  extends SQLite.default<Config>
  implements VaultDbBackend
{
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(conf: Config): Promise<boolean> {
    return new Promise((resolve, reject) => {
      import('sqlite3')
        .then((sqlite3) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
          // @ts-ignore
          if (sqlite3.Database == null) sqlite3 = sqlite3.default
          const db = (this.db = new sqlite3.Database(conf.database_host))
          /* istanbul ignore if */
          if (db == null) {
            throw new Error('Database not created')
          }
          return db.run(
            `SELECT * FROM ${recoveryWordsSQL.title}`,
            (err: any) => {
              if (err != null && /no such table/.test(err.message)) {
                const tableContent = Object.values(
                  recoveryWordsSQL.columns
                ).join(',')
                db.run(
                  `CREATE TABLE ${recoveryWordsSQL.title}(${tableContent})`,
                  (err: Error | null) => {
                    if (err != null) {
                      reject(
                        new Error(
                          `Did not succeed to create ${recoveryWordsSQL.title} table in database`,
                          { cause: err }
                        )
                      )
                    } else {
                      resolve(true)
                    }
                  }
                )
              } else {
                resolve(true)
              }
            }
          )
        })
        .catch((e) => {
          /* istanbul ignore next */
          throw e
        })
    })
  }
}
