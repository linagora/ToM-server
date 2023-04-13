import { type ClientConfig } from 'pg'
import { type UserDBBackend } from '..'
import { type Config } from '../..'
import Pg, { type PgDatabase } from '../../db/sql/pg'

class UserDBPg extends Pg implements UserDBBackend {
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(conf: Config): Promise<boolean> {
    return new Promise((resolve, reject) => {
      import('pg')
        .then((pg) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
          // @ts-ignore
          if (pg.Database == null) pg = pg.default
          if (
            conf.database_host == null ||
            conf.database_user == null ||
            conf.database_password == null ||
            conf.database_name == null
          ) {
            throw new Error(
              'database_name, database_user and database_password are required when using Postgres'
            )
          }
          const opts: ClientConfig = {
            host: conf.database_host,
            user: conf.database_user,
            password: conf.database_password,
            database: conf.database_name
          }
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (conf.database_host.match(/^(.*):(\d+)/)) {
            opts.host = RegExp.$1
            opts.port = parseInt(RegExp.$2)
          }
          const db: PgDatabase = (this.db = new pg.Client(opts))
          db.connect()
            .then(() => {
              resolve(true)
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

export default UserDBPg
