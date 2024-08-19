import { type TwakeLogger } from '@twake/logger'
import { type ClientConfig } from 'pg'
import { type Config, type DbGetResult } from '../../types'
import { type MatrixDBmodifiedBackend, type Collections } from '../'
import { Pg } from '@twake/matrix-identity-server'

class MatrixDBPg extends Pg<Collections> implements MatrixDBmodifiedBackend {
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(
    conf: Config,
    tables: Record<Collections, string>,
    indexes: Partial<Record<Collections, string[]>>,
    initializeValues: Partial<
      Record<Collections, Array<Record<string, string | number>>>
    >,
    logger: TwakeLogger
  ): Promise<void> {
    if (this.db != null) return Promise.resolve()
    return new Promise((resolve, reject) => {
      import('pg')
        .then((pg) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
          // @ts-ignore
          if (pg.Database == null) pg = pg.default
          if (
            conf.matrix_database_host == null ||
            conf.matrix_database_user == null ||
            conf.matrix_database_password == null ||
            conf.matrix_database_name == null
          ) {
            throw new Error(
              'database_name, database_user and database_password are required when using Postgres'
            )
          }
          const opts: ClientConfig = {
            host: conf.matrix_database_host,
            user: conf.matrix_database_user,
            password: conf.matrix_database_password,
            database: conf.matrix_database_name,
            ssl: conf.matrix_database_ssl
          }
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (conf.matrix_database_host.match(/^(.*):(\d+)/)) {
            opts.host = RegExp.$1
            opts.port = parseInt(RegExp.$2)
          }
          try {
            this.db = new pg.Pool(opts)
            resolve()
          } catch (e) {
            logger.error('Unable to connect to Pg database')
            reject(e)
          }
        })
        .catch((e) => {
          logger.error('Unable to load pg module')
          reject(e)
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  updateWithConditions(
    table: Collections,
    values: Record<string, string | number | null>,
    conditions: Array<{ field: string; value: string | number }>
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
        return
      }

      const names = Object.keys(values)
      const vals = Object.values(values)

      // Add the values for the conditions to the vals array
      conditions.forEach((condition) => {
        vals.push(condition.value)
      })

      // Construct the SET clause for the update statement
      const setClause = names.map((name, i) => `${name} = $${i + 1}`).join(', ')

      // Construct the WHERE clause for the conditions
      const whereClause = conditions
        .map((condition, i) => `${condition.field} = $${names.length + i + 1}`)
        .join(' AND ')

      const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *;`

      this.db.query(
        query,
        vals,
        (err: Error, result: { rows: DbGetResult }) => {
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (err) {
            reject(err)
          } else {
            resolve(result.rows)
          }
        }
      )
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
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
        return
      }

      let whereClause: string
      if (searchAllUsers) {
        whereClause = 'user_id != $1'
      } else {
        whereClause = `
        (
          EXISTS (SELECT 1 FROM users_in_public_rooms WHERE user_id = t.user_id)
          OR EXISTS (
            SELECT 1 FROM users_who_share_private_rooms
            WHERE user_id = $1 AND other_user_id = t.user_id
          )
        )
      `
      }

      const [fullQuery, exactQuery, prefixQuery] =
        parseQueryPostgres(searchTerm)
      const args = [userId, fullQuery, exactQuery, prefixQuery, limit + 1]

      const sql = `
      WITH matching_users AS (
        SELECT user_id, vector 
        FROM user_directory_search 
        WHERE vector @@ to_tsquery('simple', $2)
        LIMIT 10000
      )
      SELECT d.user_id AS user_id, display_name, avatar_url
      FROM matching_users as t
      INNER JOIN user_directory AS d USING (user_id)
      LEFT JOIN users AS u ON t.user_id = u.name
      WHERE ${whereClause}
      ORDER BY
        (CASE WHEN d.user_id IS NOT NULL THEN 4.0 ELSE 1.0 END)
        * (CASE WHEN display_name IS NOT NULL THEN 1.2 ELSE 1.0 END)
        * (CASE WHEN avatar_url IS NOT NULL THEN 1.2 ELSE 1.0 END)
        * (
          3 * ts_rank_cd(
            '{0.1, 0.1, 0.9, 1.0}',
            vector,
            to_tsquery('simple', $3),
            8
          )
          + ts_rank_cd(
            '{0.1, 0.1, 0.9, 1.0}',
            vector,
            to_tsquery('simple', $4),
            8
          )
        )
        DESC,
        display_name IS NULL,
        avatar_url IS NULL
      LIMIT $5
    `

      this.db.query(sql, args, (err: Error, result: { rows: DbGetResult }) => {
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (err) {
          reject(err)
        } else {
          resolve(result.rows)
        }
      })
    })
  }
}

function parseQueryPostgres(searchTerm: string): [string, string, string] {
  /**
   * Takes a plain string from the user and converts it into a form
   * that can be passed to the database.
   * This function allows us to add prefix matching, which isn't supported by default.
   */

  searchTerm = searchTerm.toLowerCase()
  searchTerm = searchTerm.normalize('NKFD')

  const escapedWords: string[] = []
  for (const word of parseWordsWithRegex(searchTerm)) {
    const quotedWord = word.replace(/'/g, "''").replace(/\\/g, '\\\\')
    escapedWords.push(`'${quotedWord}'`)
  }

  const both = escapedWords.map((word) => `(${word}:* | ${word})`).join(' & ')
  const exact = escapedWords.join(' & ')
  const prefix = escapedWords.map((word) => `${word}:*`).join(' & ')

  return [both, exact, prefix]
}

function parseWordsWithRegex(searchTerm: string): string[] {
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

export default MatrixDBPg
