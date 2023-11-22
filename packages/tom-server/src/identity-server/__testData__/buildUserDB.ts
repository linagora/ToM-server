/* istanbul ignore file */
import Pg from 'pg'
import sqlite3 from 'sqlite3'

interface Config {
  database_host: string
  [k: string]: any
}

let created = false


const createQuery = 'CREATE TABLE users (uid varchar(8), mobile varchar(12), mail varchar(32))'
const insertQuery = "INSERT INTO users VALUES('dwho', '33612345678', 'dwho@example.com')"

// eslint-disable-next-line @typescript-eslint/promise-function-async
const buildUserDB = (conf: Config, recreate?: boolean): Promise<void> => {
  if (created && (recreate == null || !recreate)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (conf.database_engine === 'sqlite') {
      const matrixDb = new sqlite3.Database(conf.matrix_database_host)
      
      matrixDb.run('CREATE TABLE users (name text, desactivated text, admin integer)', (err) => {
        if (err != null) {
          reject(err)
        } else {
          matrixDb.run("INSERT INTO users VALUES('@dwho:example.com', '', 0)", (err) => {
            if (err != null) {
              reject(err)
            } else {
              matrixDb.close((err) => {
                /* istanbul ignore if */
                if(err != null) {
                  console.error(err)
                  reject(err)
                } else {
                  const userDb = new sqlite3.Database(conf.userdb_host)
                  userDb.run(createQuery, (err) => {
                    if (err != null) {
                      reject(err)
                    } else {
                      Promise.all(
                        // eslint-disable-next-line @typescript-eslint/promise-function-async
                          Array.from(Array(31).keys()).map((v: string | number) => {
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                            // @ts-ignore v is first a number
                            if (v < 10) v = `0${v}`
                            return new Promise((_resolve, _reject) => {
                              userDb.run(`INSERT INTO users VALUES('user${v}', '', 'user${v}@example.com')`, (err) => {
                                err != null ? _reject(err) : _resolve(true)
                              })
                            })
                          })
                        )
                        .then(() => {
                          userDb.run(insertQuery, (err) => {
                            if (err != null) {
                              reject(err)
                            } else {
                              userDb.close((err) => {
                                /* istanbul ignore if */
                                if(err != null) {
                                  console.error(err)
                                  reject(err)
                                } else {
                                  created = true
                                  resolve()
                                }
                              })
                           }
                          })    
                        })
                        .catch(reject)
                    }
                  })
                    }
              })
            }
          })
        }
      })
      
    } else {
      const userDb = new Pg.Client({
        host: conf.userdb_host,
        user: conf.userdb_user,
        password: conf.userdb_password,
        database: conf.userdb_name
      })
      userDb.connect().then(() => {
        console.error('CONNECT')
        userDb.query(createQuery).then(() => {
          userDb.query(insertQuery).then(() => {
            resolve()
          }).catch(reject)
        }).catch(reject)
      }).catch(reject)
    }
  })
}

export default buildUserDB
