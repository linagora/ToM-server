import { type TwakeLogger } from '@twake/logger'
import { type ClientConfig } from 'pg'
import { type Collections } from '..'
import { type MatrixDBBackend } from '../'
import Pg from '../../db/sql/pg'
import { type Config } from '../../types'

class MatrixDBPg extends Pg<Collections> implements MatrixDBBackend {
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
    if (this.db != null) {
      this.logger.debug(
        '[MatrixDBPg][createDatabases] Database already initialized'
      )
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      this.logger.debug(
        '[MatrixDBPg][createDatabases] Initializing database connection'
      )
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
            const error = new Error(
              'database_name, database_user and database_password are required when using Postgres'
            )
            this.logger.error(
              '[MatrixDBPg][createDatabases] Configuration incomplete',
              {
                hasHost: conf.matrix_database_host != null,
                hasUser: conf.matrix_database_user != null,
                hasPassword: conf.matrix_database_password != null,
                hasName: conf.matrix_database_name != null
              }
            )
            throw error
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
          const sslType =
            opts.ssl == null || opts.ssl === false
              ? 'disabled'
              : opts.ssl === true
              ? 'enabled'
              : typeof opts.ssl === 'object'
              ? 'object'
              : `unexpected(${typeof opts.ssl}: ${String(opts.ssl)})`
          this.logger.info(
            '[MatrixDBPg][createDatabases] Creating connection pool',
            {
              host: opts.host,
              port: opts.port,
              database: opts.database,
              ssl: sslType
            }
          )
          try {
            this.db = new pg.Pool(opts)
            this.db.on('error', (err) => {
              this.logger.error(
                '[MatrixDBPg] Pool background error',
                {
                  error: err.message,
                  code: (err as NodeJS.ErrnoException).code
                }
              )
            })
            this.db
              .query('SELECT 1')
              .then(() => {
                this.logger.info(
                  '[MatrixDBPg][createDatabases] Connection verified',
                  {
                    host: opts.host,
                    database: opts.database
                  }
                )
                resolve()
              })
              .catch((err: NodeJS.ErrnoException) => {
                this.logger.error(
                  '[MatrixDBPg][createDatabases] Connection test failed',
                  {
                    error: err.message,
                    code: err.code
                  }
                )
                reject(err)
              })
          } catch (e) {
            this.logger.error(
              '[MatrixDBPg][createDatabases] Unable to connect',
              {
                error: e
              }
            )
            reject(e)
          }
        })
        .catch((e) => {
          this.logger.error(
            '[MatrixDBPg][createDatabases] Unable to load pg module',
            {
              error: e
            }
          )
          reject(e)
        })
    })
  }
}

export default MatrixDBPg
