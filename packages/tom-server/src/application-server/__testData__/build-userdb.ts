/* istanbul ignore file */
import sqlite3 from 'sqlite3'

interface Config {
  database_host: string
  [k: string]: any
}

let created = false

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const buildUserDB = (conf: Partial<Config>): Promise<void> => {
  if (created) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const matrixDb = new sqlite3.Database(conf.matrix_database_host)

    matrixDb.run(
      'CREATE TABLE users (name text, desactivated text, admin integer)',
      (err) => {
        if (err != null) {
          reject(err)
        } else {
          created = true
          resolve()
        }
      }
    )
  })
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const deleteUserDB = (conf: Partial<Config>): Promise<void> => {
  return new Promise((resolve, reject) => {
    const matrixDb = new sqlite3.Database(conf.matrix_database_host)
    matrixDb.run(
      'DROP TABLE users',
      (err) => {
        if (err != null) {
          reject(err)
        } else {
          resolve()
        }
      }
    )
  })
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const addUser = (conf: Partial<Config>, usersIds: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const matrixDb = new sqlite3.Database(conf.matrix_database_host)
    usersIds.forEach((userId) => {
      matrixDb.run(
        // columns headers: name|password_hash|creation_ts(seconds)|admin|upgrade_ts|is_guest|appservice_id|consent_version|consent_server_notice_sent|user_type|deactivated|shadow_banned|consent_ts|approved 
        `INSERT INTO users VALUES('${userId}', '', ${Math.floor(Date.now() / 1000)}, 0, '', 0, '', '', '', '', 0, 0, '', 1)`,
        (err) => {
          if (err != null) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
  })
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const updateUser = (conf: Partial<Config>, userId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const matrixDb = new sqlite3.Database(conf.matrix_database_host)
      matrixDb.run(
        // columns headers: name|password_hash|creation_ts(seconds)|admin|upgrade_ts|is_guest|appservice_id|consent_version|consent_server_notice_sent|user_type|deactivated|shadow_banned|consent_ts|approved 
        `UPDATE users SET admin = 1 WHERE name = '${userId}'`,
        (err) => {
          if (err != null) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
  })
}
