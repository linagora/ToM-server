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
    values: Record<string, string | number>,
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
          if (err) {
            reject(err)
          } else {
            resolve(result.rows)
          }
        }
      )
    })
  }
}

export default MatrixDBPg
