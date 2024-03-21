import { type TwakeLogger } from '@twake/logger'
import { type ClientConfig } from 'pg'
import { type UserDBBackend } from '../'
import { type Collections } from '../../db'
import Pg from '../../db/sql/pg'
import { type Config } from '../../types'

class UserDBPg extends Pg implements UserDBBackend {
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
    return new Promise((resolve, reject) => {
      import('pg')
        .then((pg) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
          // @ts-ignore
          if (pg.Database == null) pg = pg.default
          if (
            conf.userdb_host == null ||
            conf.userdb_user == null ||
            conf.userdb_password == null ||
            conf.userdb_name == null
          ) {
            throw new Error(
              'userdb_name, userdb_user and userdb_password are required when using Postgres'
            )
          }
          const opts: ClientConfig = {
            host: conf.userdb_host,
            user: conf.userdb_user,
            password: conf.userdb_password,
            database: conf.userdb_name,
            ssl: conf.userdb_ssl
          }
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (conf.userdb_host.match(/^(.*):(\d+)/)) {
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
}

export default UserDBPg
