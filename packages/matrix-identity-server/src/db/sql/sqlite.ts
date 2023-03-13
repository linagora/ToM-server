import sqlite3, { type Database, type Statement } from 'sqlite3'
import { type Config } from '../..'
import SQL, { tables } from './sql'

export type SQLiteDatabase = Database

export type SQLiteStatement = Statement

class SQLite extends SQL {
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases (conf: Config): Promise<boolean> {
    const db = this.db = new sqlite3.Database(conf.database_host)
    if (db == null) {
      /* istanbul ignore next */
      throw new Error('Database not created')
    }
    return new Promise((resolve, reject) => {
      db.run('SELECT count(id) FROM tokens', (err: any) => {
        if (err != null && /no such table/.test(err.message)) {
          let created = 0
          Object.keys(tables).forEach((table, i, arr) => {
            db.run(`CREATE TABLE ${table}(${tables[table as keyof typeof tables]})`, (err: any) => {
            /* istanbul ignore next */
              if (err != null) {
                throw new Error(err)
              } else {
                created++
                if (created === arr.length) {
                  resolve(true)
                } else if (i === arr.length) {
                  reject(new Error(`Was able to create ${created} database instead of ${arr.length}`))
                }
              }
            })
          })
        } else {
          /* istanbul ignore next */
          resolve(true)
        }
      })
    })
  }
}

export default SQLite
