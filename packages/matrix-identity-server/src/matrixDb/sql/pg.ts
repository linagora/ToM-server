import { type ClientConfig } from 'pg'
import { type Collections } from '../../db'
import { type MatrixDBBackend } from '../'
import { type Config } from '../../types'
import Pg, { type PgDatabase } from '../../db/sql/pg'

class MatrixDBPg extends Pg implements MatrixDBBackend {
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(
    conf: Config,
    tables: Record<Collections, string>,
    indexes: Partial<Record<Collections, string[]>>,
    initializeValues: Partial<
      Record<Collections, Array<Record<string, string | number>>>
    >
  ): Promise<void> {
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
            ssl: conf.matrix_database_ssl ? true : false
          }
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (conf.matrix_database_host.match(/^(.*):(\d+)/)) {
            opts.host = RegExp.$1
            opts.port = parseInt(RegExp.$2)
          }
          const db: PgDatabase = (this.db = new pg.Client(opts))
          db.connect()
            .then(() => {
              resolve()
            })
            .catch((e: any) => {
              console.error('Unable to connect to Pg database')
              reject(e)
            })
        })
        .catch((e) => {
          console.error('Unable to load pg module')
          reject(e)
        })
    })
  }
}

export default MatrixDBPg
