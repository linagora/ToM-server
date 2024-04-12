import sqlite3 from 'sqlite3'
import { type Config } from '../../types'

let created = false

const createQuery =
  'CREATE TABLE users (uid varchar(8), mobile varchar(12), mail varchar(32), sn varchar(32))'
const insertQueries = [
  "INSERT INTO users VALUES('dwho', '33612345678', 'dwho@company.com', 'Dwho')",
  "INSERT INTO users VALUES('rtyler', '33687654321', 'rtyler@company.com', 'Rtyler')"
]

// eslint-disable-next-line @typescript-eslint/promise-function-async
const buildUserDB = (conf: Config): Promise<void> => {
  if (created) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const matrixDb = new sqlite3.Database(conf.matrix_database_host)
    matrixDb.run(
      'CREATE TABLE users (name text, desactivated text, admin integer)',
      (err) => {
        if (err != null) {
          reject(err)
        } else {
          matrixDb.run(
            "INSERT INTO users VALUES('@dwho:example.com', '', 0)",
            (err) => {
              if (err != null) {
                reject(err)
              } else {
                matrixDb.close((err) => {
                  /* istanbul ignore if */
                  if (err != null) {
                    console.error(err)
                    reject(err)
                  } else {
                    const userDb = new sqlite3.Database(
                      conf.userdb_host as string
                    )
                    userDb.run(createQuery, (err) => {
                      if (err != null) {
                        reject(err)
                      } else {
                        Promise.all(
                          insertQueries.map(
                            // eslint-disable-next-line @typescript-eslint/promise-function-async
                            (query) =>
                              new Promise((_resolve, _reject) => {
                                userDb.run(query, (err) => {
                                  err != null ? _reject(err) : _resolve(true)
                                })
                              })
                          )
                        )
                          .then(() => {
                            userDb.close((err) => {
                              /* istanbul ignore if */
                              if (err != null) {
                                console.error(err)
                                reject(err)
                              } else {
                                created = true
                                resolve()
                              }
                            })
                          })

                          .catch(reject)
                      }
                    })
                  }
                })
              }
            }
          )
        }
      }
    )
  })
}

export default buildUserDB
