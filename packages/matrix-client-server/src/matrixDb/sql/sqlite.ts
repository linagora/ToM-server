import { type Collections, type MatrixDBmodifiedBackend } from '../'
import { type DbGetResult, type Config } from '../../types'
import { SQLite } from '@twake/matrix-identity-server'

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

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  searchUserDirectory(
    userId: string,
    searchTerm: string,
    limit: number,
    searchAllUsers: boolean
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }

      let whereClause: string
      if (searchAllUsers) {
        whereClause = 'user_id != ?'
      } else {
        whereClause = `
          (
            EXISTS (SELECT 1 FROM users_in_public_rooms WHERE user_id = t.user_id)
            OR EXISTS (
              SELECT 1 FROM users_who_share_private_rooms
              WHERE user_id = ? AND other_user_id = t.user_id
            )
          )
        `
      }
      const searchQuery = parseQuerySqlite(searchTerm)
      const args = [userId, searchQuery, limit + 1]

      const stmt = this.db.prepare(`
        SELECT d.user_id AS user_id, display_name, avatar_url,
               matchinfo(user_directory_search) AS match_info
        FROM user_directory_search as t
        INNER JOIN user_directory AS d USING (user_id)
        LEFT JOIN users AS u ON t.user_id = u.name
        WHERE ${whereClause}
        AND value MATCH ?
        ORDER BY
          match_info DESC,
          display_name IS NULL,
          avatar_url IS NULL
        LIMIT ?
      `)

      stmt.all(
        args,
        (err: Error | null, rows: Array<Record<string, string | number>>) => {
          /* istanbul ignore if */
          if (err != null) {
            reject(err)
          } else {
            resolve(rows)
          }
        }
      )

      stmt.finalize((err: Error | null) => {
        /* istanbul ignore if */
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (err) {
          reject(err)
        }
      })
    })
  }
}

export function parseQuerySqlite(searchTerm: string): string {
  /**
   * Takes a plain string from the user and converts it into a form
   * that can be passed to the database.
   * This function allows us to add prefix matching, which isn't supported by default.
   *
   * We specifically add both a prefix and non-prefix matching term so that
   * exact matches get ranked higher.
   */

  searchTerm = searchTerm.toLowerCase()
  searchTerm = searchTerm.normalize('NFKD')

  // Pull out the individual words, discarding any non-word characters.
  const results = parseWordsWithRegex(searchTerm)

  // Construct the SQLite query string for full-text search with prefix matching
  return results.map((result) => `(${result}* OR ${result})`).join(' & ')
}

export function parseWordsWithRegex(searchTerm: string): string[] {
  /**
   * Break down the search term into words using a regular expression,
   * when we don't have ICU available.
   */
  const regex = /[\w-]+/g
  const matches = searchTerm.match(regex)

  if (matches === null) {
    return []
  }
  return matches
}

export default MatrixDBSQLite
