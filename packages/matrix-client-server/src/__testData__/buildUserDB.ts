/* istanbul ignore file */
import { getLogger, type TwakeLogger } from '@twake/logger'
import sqlite3 from 'sqlite3'
import { type Config } from '../types'
import {type UserDBPg, type UserDBSQLite, UserDB}  from '@twake/matrix-identity-server'

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
  'CREATE TABLE user_ips ( user_id TEXT NOT NULL, access_token TEXT NOT NULL, device_id TEXT, ip TEXT NOT NULL, user_agent TEXT NOT NULL, last_seen BIGINT NOT NULL)',
  'CREATE TABLE registration_tokens (token TEXT NOT NULL,  uses_allowed INT, pending INT NOT NULL,  completed INT NOT NULL, expiry_time BIGINT,UNIQUE (token))',
  'CREATE TABLE IF NOT EXISTS "devices" (user_id TEXT NOT NULL, device_id TEXT NOT NULL, display_name TEXT, last_seen BIGINT, ip TEXT, user_agent TEXT, hidden BOOLEAN DEFAULT 0,CONSTRAINT device_uniqueness UNIQUE (user_id, device_id))',
  'CREATE TABLE IF NOT EXISTS "pushers" ( id BIGINT PRIMARY KEY, user_name TEXT NOT NULL, access_token BIGINT DEFAULT NULL, profile_tag TEXT NOT NULL, kind TEXT NOT NULL, app_id TEXT NOT NULL, app_display_name TEXT NOT NULL, device_display_name TEXT NOT NULL, pushkey TEXT NOT NULL, ts BIGINT NOT NULL, lang TEXT, data TEXT, last_stream_ordering INTEGER, last_success BIGINT, failing_since BIGINT, UNIQUE (app_id, pushkey, user_name) )',
  'CREATE TABLE push_rules_enable ( id BIGINT PRIMARY KEY, user_name TEXT NOT NULL, rule_id TEXT NOT NULL, enabled SMALLINT, UNIQUE(user_name, rule_id) )'
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
