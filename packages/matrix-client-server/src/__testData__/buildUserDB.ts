/* istanbul ignore file */
import { getLogger, type TwakeLogger } from '@twake/logger'
import sqlite3 from 'sqlite3'
import { type Config } from '../types'
import UserDB from '../../../matrix-identity-server/src/userdb'
import type UserDBPg from '../../../matrix-identity-server/src/userdb/sql/pg'
import type UserDBSQLite from '../../../matrix-identity-server/src/userdb/sql/sqlite'

const logger: TwakeLogger = getLogger()

let created = false
let matrixDbCreated = false

const createQuery =
  'CREATE TABLE IF NOT EXISTS users (uid varchar(8), mobile varchar(12), mail varchar(32))'
const insertQuery =
  "INSERT INTO users VALUES('dwho', '33612345678', 'dwho@company.com')"
const insertQuery2 =
  "INSERT INTO users VALUES('rtyler', '33687654321', 'rtyler@company.com')"

const matrixDbQueries = [
  'CREATE TABLE IF NOT EXISTS profiles( user_id TEXT NOT NULL, displayname TEXT, avatar_url TEXT, UNIQUE(user_id) )',
  'CREATE TABLE IF NOT EXISTS users( name TEXT, password_hash TEXT, creation_ts BIGINT, admin SMALLINT DEFAULT 0 NOT NULL, upgrade_ts BIGINT, is_guest SMALLINT DEFAULT 0 NOT NULL, appservice_id TEXT, consent_version TEXT, consent_server_notice_sent TEXT, user_type TEXT DEFAULT NULL, deactivated SMALLINT DEFAULT 0 NOT NULL, shadow_banned INT DEFAULT 0, consent_ts bigint, UNIQUE(name) )',
  'CREATE TABLE IF NOT EXISTS user_ips ( user_id TEXT NOT NULL, access_token TEXT NOT NULL, device_id TEXT, ip TEXT NOT NULL, user_agent TEXT NOT NULL, last_seen BIGINT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS registration_tokens (token TEXT NOT NULL,  uses_allowed INT, pending INT NOT NULL,  completed INT NOT NULL, expiry_time BIGINT,UNIQUE (token))',
  'CREATE TABLE IF NOT EXISTS account_data( user_id TEXT NOT NULL, account_data_type TEXT NOT NULL, stream_id BIGINT NOT NULL, content TEXT NOT NULL, instance_name TEXT, CONSTRAINT account_data_uniqueness UNIQUE (user_id, account_data_type))'
]

// eslint-disable-next-line @typescript-eslint/promise-function-async
const runQueries = (
  db: sqlite3.Database | any,
  queries: string[],
  isSqlite: boolean
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const runNextQuery = (index: number): void => {
      if (index >= queries.length) {
        resolve()
      } else {
        if (isSqlite) {
          db.run(queries[index], (err: Error | null) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (err) {
              reject(err)
            } else {
              runNextQuery(index + 1)
            }
          })
        } else {
          db.query(queries[index], (err: Error | null) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (err) {
              reject(err)
            } else {
              runNextQuery(index + 1)
            }
          })
        }
      }
    }
    runNextQuery(0)
  })
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const buildUserDB = (conf: Config): Promise<void> => {
  if (created) return Promise.resolve()
  const userDb = new UserDB(conf, logger)
  return new Promise((resolve, reject) => {
    /* istanbul ignore else */
    if (conf.userdb_engine === 'sqlite') {
      userDb.ready
        .then(() => {
          ;(userDb.db as UserDBSQLite).db?.run(createQuery, () => {
            ;(userDb.db as UserDBSQLite).db?.run(insertQuery, () => {
              ;(userDb.db as UserDBSQLite).db
                ?.run(insertQuery2)
                .close((err) => {
                  /* istanbul ignore if */
                  if (err != null) {
                    reject(err)
                  } else {
                    logger.close()
                    created = true
                    resolve()
                  }
                })
            })
          })
        })
        .catch(reject)
    } else {
      ;(userDb.db as UserDBPg).db?.query(createQuery, () => {
        ;(userDb.db as UserDBPg).db?.query(insertQuery, () => {
          logger.close()
          created = true
          resolve()
        })
      })
    }
  })
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const buildMatrixDb = (conf: Config): Promise<void> => {
  if (matrixDbCreated) return Promise.resolve()
  const matrixDb = new sqlite3.Database(conf.matrix_database_host as string)
  return new Promise((resolve, reject) => {
    if (conf.matrix_database_engine === 'sqlite') {
      runQueries(matrixDb, matrixDbQueries, true)
        .then(() => {
          matrixDb.close((err) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (err) {
              reject(err)
            } else {
              matrixDbCreated = true
              resolve()
            }
          })
        })
        .catch((err) => {
          matrixDb.close(() => {
            reject(err)
          })
        })
    } else {
      matrixDb.close(() => {
        reject(new Error('only SQLite is implemented here'))
      })
    }
  })
}
