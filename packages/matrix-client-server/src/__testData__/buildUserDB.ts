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

const createQuery = 'CREATE TABLE IF NOT EXISTS users (uid varchar(8), mobile varchar(12), mail varchar(32))'
const insertQuery = "INSERT INTO users VALUES('dwho', '33612345678', 'dwho@company.com')"
const insertQuery2 = "INSERT INTO users VALUES('rtyler', '33687654321', 'rtyler@company.com')"

const createQueryMat1 = 'CREATE TABLE IF NOT EXISTS profiles( user_id TEXT NOT NULL, displayname TEXT, avatar_url TEXT, UNIQUE(user_id) )'
const insertQueryMat1 = "INSERT INTO profiles VALUES('dwho', 'D Who', 'http://example.com/avatar.jpg')"

// eslint-disable-next-line @typescript-eslint/promise-function-async
const buildUserDB = (conf: Config): Promise<void> => {
  if (created) return Promise.resolve()
  const userDb = new UserDB(conf, logger)
  return new Promise((resolve, reject) => {
    /* istanbul ignore else */
    if (conf.userdb_engine === 'sqlite') {
      userDb.ready.then(() => {
        (userDb.db as UserDBSQLite).db?.run(createQuery, () => {
          (userDb.db as UserDBSQLite).db?.run(insertQuery, () => {
            (userDb.db as UserDBSQLite).db?.run(insertQuery2).close((err) => {
              /* istanbul ignore if */
              if(err != null) {
                reject(err)
              } else {
                logger.close()
                created = true
                resolve()
              }
            })
          })
        })
      }).catch(reject)
    } else {
      (userDb.db as UserDBPg).db?.query(createQuery, () => {
        (userDb.db as UserDBPg).db?.query(insertQuery, () => {
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
      /* istanbul ignore else */
      if (conf.matrix_database_engine === 'sqlite') {
      matrixDb.run(createQueryMat1, () => {
        matrixDb.run(insertQueryMat1).close((err) => {
          /* istanbul ignore if */
          if(err != null) {
            reject(err)
          } else {
            matrixDbCreated = true
            resolve()
          }
        })
      })
    } else {
      throw new Error('only SQLite is implemented here')
    }
  })
}

export default buildUserDB