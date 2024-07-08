import { type Collections, type MatrixDBmodifiedBackend } from '../'
import { type Config } from '../../types'
import { SQLite, type DbGetResult } from '@twake/matrix-identity-server'

class MatrixDBSQLite
  extends SQLite<Collections>
  implements MatrixDBmodifiedBackend
{
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(
    conf: Config,
    tables: Record<Collections, string>,
    indexes: Partial<Record<Collections, string[]>>,
    initializeValues: Partial<
      Record<Collections, Array<Record<string, string | number>>>
    >
  ): Promise<void> {
    /* istanbul ignore if */
    if (this.db != null) return Promise.resolve()
    return new Promise((resolve, reject) => {
      import('sqlite3')
        .then((sqlite3) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
          /* istanbul ignore next */ // @ts-ignore
          if (sqlite3.Database == null) sqlite3 = sqlite3.default
          const db = (this.db = new sqlite3.Database(
            conf.matrix_database_host as string,
            sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE // IT SHOULD ALWAYS BE READWRITE as we connect the synapse db
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

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  updateWithConditions(
    table: Collections,
    values: Record<string, string | number>,
    conditions: Array<{ field: string; value: string | number }>
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }
      const names = Object.keys(values)
      const vals = Object.values(values)
      // Add the values for the conditions to the vals array
      conditions.forEach((condition) => {
        vals.push(condition.value)
      })

      // Construct the SET clause for the update statement
      const setClause = names.map((name) => `${name} = ?`).join(', ')

      // Construct the WHERE clause for the conditions
      const whereClause = conditions
        .map((condition) => `${condition.field} = ?`)
        .join(' AND ')

      const stmt = this.db.prepare(
        `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *;`
      )

      stmt.all(
        vals,
        (err: string, rows: Array<Record<string, string | number>>) => {
          /* istanbul ignore if */
          if (err != null) {
            reject(err)
          } else {
            resolve(rows)
          }
        }
      )

      stmt.finalize((err) => {
        /* istanbul ignore if */
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (err) {
          reject(err)
        }
      })
    })
  }
}

export default MatrixDBSQLite
