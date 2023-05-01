/* istanbul ignore file */
import { type Config } from '..'
import sqlite3 from 'sqlite3'
import UserDB from '../userdb'
import type UserDBPg from '../userdb/sql/pg'
import type UserDBSQLite from '../userdb/sql/sqlite'

let created = false
let matrixDbCreated = false

const createQuery = 'CREATE TABLE users (uid varchar(8), mobile varchar(12), mail varchar(32))'
const insertQuery = "INSERT INTO users VALUES('dwho', '33612345678', 'dwho@company.com')"
const insertQuery2 = "INSERT INTO users VALUES('rtyler', '33687654321', 'rtyler@company.com')"
const mCreateQuery = 'CREATE TABLE users (name text)'
const mInsertQuery = "INSERT INTO users VALUES('@dwho:company.com')"

// eslint-disable-next-line @typescript-eslint/promise-function-async
const buildUserDB = (conf: Config): Promise<void> => {
  if (created) return Promise.resolve()
  const userDb = new UserDB(conf)
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
      matrixDb.run(mCreateQuery, () => {
        matrixDb.run(mInsertQuery).close((err) => {
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
