/* istanbul ignore file */
import { type Config } from '..'
import UserDB from '../userdb'
import type UserDBPg from '../userdb/sql/pg'
import type UserDBSQLite from '../userdb/sql/sqlite'

let created = false

const createQuery = 'CREATE TABLE users (uid varchar(8), mobile varchar(12), mail varchar(32))'
const insertQuery = "INSERT INTO users VALUES('dwho', '33612345678', 'dwho@company.com')"

// eslint-disable-next-line @typescript-eslint/promise-function-async
const buildUserDB = (conf: Config): Promise<void> => {
  if (created) return Promise.resolve()
  const userDb = new UserDB(conf)
  return new Promise((resolve, reject) => {
    /* istanbul ignore else */
    if (conf.userdb_engine === 'sqlite') {
      userDb.ready.then(() => {
        (userDb.db as UserDBSQLite).db?.run(createQuery, () => {
          (userDb.db as UserDBSQLite).db?.run(insertQuery).close((err) => {
            /* istanbul ignore if */
            if(err != null) {
              reject(err)
            } else {
              created = true
              resolve()
            }
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

export default buildUserDB
