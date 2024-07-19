/* istanbul ignore file */
import { getLogger, type TwakeLogger } from '@twake/logger'
import sqlite3 from 'sqlite3'
import { type Config } from '../types'
import {
  type UserDBPg,
  type UserDBSQLite,
  UserDB
} from '@twake/matrix-identity-server'

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
  'CREATE TABLE IF NOT EXISTS events( stream_ordering INTEGER PRIMARY KEY, topological_ordering BIGINT NOT NULL, event_id TEXT NOT NULL, type TEXT NOT NULL, room_id TEXT NOT NULL, content TEXT, unrecognized_keys TEXT, processed BOOL NOT NULL, outlier BOOL NOT NULL, depth BIGINT DEFAULT 0 NOT NULL, origin_server_ts BIGINT, received_ts BIGINT, sender TEXT, contains_url INT, instance_name TEXT, state_key TEXT DEFAULT NULL, rejection_reason TEXT DEFAULT NULL, UNIQUE (event_id) )',
  'CREATE TABLE IF NOT EXISTS room_memberships( event_id TEXT NOT NULL, user_id TEXT NOT NULL, sender TEXT NOT NULL, room_id TEXT NOT NULL, membership TEXT NOT NULL, forgotten INTEGER DEFAULT 0, display_name TEXT, avatar_url TEXT, UNIQUE (event_id) )',
  'CREATE TABLE IF NOT EXISTS devices (user_id TEXT NOT NULL, device_id TEXT NOT NULL, display_name TEXT, last_seen BIGINT, ip TEXT, user_agent TEXT, hidden INT DEFAULT 0,CONSTRAINT device_uniqueness UNIQUE (user_id, device_id))',
  'CREATE TABLE IF NOT EXISTS account_data( user_id TEXT NOT NULL, account_data_type TEXT NOT NULL, stream_id BIGINT NOT NULL, content TEXT NOT NULL, instance_name TEXT, CONSTRAINT account_data_uniqueness UNIQUE (user_id, account_data_type))',
  'CREATE TABLE IF NOT EXISTS room_account_data( user_id TEXT NOT NULL, room_id TEXT NOT NULL, account_data_type TEXT NOT NULL, stream_id BIGINT NOT NULL, content TEXT NOT NULL, instance_name TEXT, CONSTRAINT room_account_data_uniqueness UNIQUE (user_id, room_id, account_data_type) )',
  'CREATE TABLE IF NOT EXISTS profiles( user_id TEXT NOT NULL, displayname TEXT, avatar_url TEXT, UNIQUE(user_id) )',
  'CREATE TABLE IF NOT EXISTS local_current_membership (room_id TEXT NOT NULL, user_id TEXT NOT NULL, event_id TEXT NOT NULL, membership TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS room_stats_state (room_id TEXT NOT NULL,name TEXT,canonical_alias TEXT,join_rules TEXT,history_visibility TEXT,encryption TEXT,avatar TEXT,guest_access TEXT,is_federatable INT,topic TEXT, room_type TEXT)',
  'CREATE TABLE IF NOT EXISTS room_aliases( room_alias TEXT NOT NULL, room_id TEXT NOT NULL, creator TEXT, UNIQUE (room_alias) )',
  'CREATE TABLE IF NOT EXISTS rooms( room_id TEXT PRIMARY KEY NOT NULL, is_public BOOL, creator TEXT , room_version TEXT, has_auth_chain_index INT)',
  'CREATE TABLE IF NOT EXISTS room_tags( user_id TEXT NOT NULL, room_id TEXT NOT NULL, tag TEXT NOT NULL, content TEXT NOT NULL, CONSTRAINT room_tag_uniqueness UNIQUE (user_id, room_id, tag) )',
  'CREATE TABLE IF NOT EXISTS "user_threepids" ( user_id TEXT NOT NULL, medium TEXT NOT NULL, address TEXT NOT NULL, validated_at BIGINT NOT NULL, added_at BIGINT NOT NULL, CONSTRAINT medium_address UNIQUE (medium, address) )',
  'CREATE TABLE IF NOT EXISTS threepid_validation_session (session_id TEXT PRIMARY KEY,medium TEXT NOT NULL,address TEXT NOT NULL,client_secret TEXT NOT NULL,last_send_attempt BIGINT NOT NULL,validated_at BIGINT)',
  'CREATE TABLE IF NOT EXISTS threepid_validation_token (token TEXT PRIMARY KEY,session_id TEXT NOT NULL,next_link TEXT,expires BIGINT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS presence (user_id TEXT NOT NULL, state VARCHAR(20), status_msg TEXT, mtime BIGINT, UNIQUE (user_id))',
  'CREATE TABLE IF NOT EXISTS refresh_tokens (id BIGINT PRIMARY KEY,user_id TEXT NOT NULL,device_id TEXT NOT NULL,token TEXT NOT NULL,next_token_id BIGINT REFERENCES refresh_tokens (id) ON DELETE CASCADE, expiry_ts BIGINT DEFAULT NULL, ultimate_session_expiry_ts BIGINT DEFAULT NULL,UNIQUE(token))',
  'CREATE TABLE IF NOT EXISTS "access_tokens" (id BIGINT PRIMARY KEY, user_id TEXT NOT NULL, device_id TEXT, token TEXT NOT NULL,valid_until_ms BIGINT,puppets_user_id TEXT,last_validated BIGINT, refresh_token_id BIGINT REFERENCES refresh_tokens (id) ON DELETE CASCADE, used INT, UNIQUE(token))'
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
