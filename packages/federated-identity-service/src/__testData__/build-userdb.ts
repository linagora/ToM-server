/* istanbul ignore file */
import { getLogger, type TwakeLogger } from '@twake-chat/logger'
import { UserDB } from '@twake-chat/matrix-identity-server'
import sqlite3, { type Database } from 'sqlite3'
import { type Config } from '../types.ts'

let created = false
let matrixDbCreated = false

interface UserDBSQLite {
  db?: Database
}

const logger: TwakeLogger = getLogger()

const createUsersTable = 'CREATE TABLE IF NOT EXISTS users (uid varchar(255), mobile text, mail test)'
const insertLskywalker = "INSERT INTO users VALUES('lskywalker', '', 'lskywalker@example.com')"
const insertOkenobi = "INSERT INTO users VALUES('okenobi', '', 'okenobi@example.com')"
const insertAskywalker = "INSERT INTO users VALUES('askywalker', '', 'askywalker@example.com')"
const insertQjinn = "INSERT INTO users VALUES('qjinn', '', 'qjinn@example.com')"
const insertChewbacca = "INSERT INTO users VALUES('chewbacca', '', 'chewbacca@example.com')"

const mCreateUsersTable = 'CREATE TABLE IF NOT EXISTS users (name text)'
const mInsertChewbacca = "INSERT INTO users VALUES('@chewbacca:example.com')"

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const buildUserDB = (conf: Config): Promise<void> => {
  if (created) return Promise.resolve()
  const userDb = new UserDB(conf, logger)
  return new Promise((resolve, reject) => {
    userDb.ready.then(() => {
      (userDb.db as UserDBSQLite).db?.run(createUsersTable, () => {
        (userDb.db as UserDBSQLite).db?.run(insertLskywalker, () => {
          (userDb.db as UserDBSQLite).db?.run(insertAskywalker, () => {
            (userDb.db as UserDBSQLite).db?.run(insertQjinn, () => {
              (userDb.db as UserDBSQLite).db?.run(insertChewbacca, () => {
                (userDb.db as UserDBSQLite).db?.run(insertOkenobi).close((err) => {
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
          })
        })
      })
    }).catch(reject)
  })
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const buildMatrixDb = (conf: Config): Promise<void> => {
  if (matrixDbCreated) return Promise.resolve()
  const matrixDb = new sqlite3.Database(conf.matrix_database_host as string)
  return new Promise((resolve, reject) => {
    matrixDb.run(mCreateUsersTable, () => {
      matrixDb.run(mInsertChewbacca).close((err) => {
        /* istanbul ignore if */
        if(err != null) {
          reject(err)
        } else {
          matrixDbCreated = true
          resolve()
        }
      })
    })
  })
}
