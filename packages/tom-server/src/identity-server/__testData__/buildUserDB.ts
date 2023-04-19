/* istanbul ignore file */
import sqlite3 from 'sqlite3'
import Pg from 'pg'

interface Config {
  database_host: string
  [k: string]: any
}

let created = false

const createQuery = 'CREATE TABLE users (uid varchar(8), mobile varchar(12), mail varchar(32))'
const insertQuery = "INSERT INTO users VALUES('dwho', '33612345678', 'dwho@company.com')"

// eslint-disable-next-line @typescript-eslint/promise-function-async
const buildUserDB = (conf: Config): Promise<void> => {
  if (created) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (conf.database_engine === 'sqlite') {
      const userDb = new sqlite3.Database(conf.database_host)
      userDb.run(createQuery, (err) => {
        if (err != null) {
          reject(err)
        } else {
          userDb.run(insertQuery, (err) => {
            if (err != null) {
              reject(err)
            } else {
              userDb.close()
              created = true
              resolve()
            }
          })
        }
      })
    } else {
      const userDb = new Pg.Client({
        host: conf.database_host,
        user: conf.database_user,
        password: conf.database_password,
        database: conf.database_name
      })
      userDb.connect().then(() => {
        console.error('CONNECT')
        userDb.query(createQuery).then(() => {
          userDb.query(insertQuery).then(() => {
            resolve()
          }).catch(e => {
            reject(e)
          })
        }).catch(e => {
          reject(e)
        })
      }).catch(e => { reject(e) })
    }
  })
}

export default buildUserDB
