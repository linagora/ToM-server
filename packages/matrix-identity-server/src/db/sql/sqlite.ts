import sqlite3, { type Database, type Statement } from 'sqlite3'
import { type Collections } from '../index'
import { type Config } from '../..'
import SQL, { tables, indexes } from './sql'

export type SQLiteDatabase = Database

export type SQLiteStatement = Statement

class SQLite extends SQL {
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases (conf: Config): Promise<boolean> {
    const db = this.db = new sqlite3.Database(conf.database_host)
    /* istanbul ignore if */
    if (db == null) {
      throw new Error('Database not created')
    }
    return new Promise((resolve, reject) => {
      db.run('SELECT count(id) FROM accessTokens', (err: any) => {
        if (err != null && /no such table/.test(err.message)) {
          let created = 0
          Object.keys(tables).forEach((table, i, arr) => {
            db.run(`CREATE TABLE ${table}(${tables[table as keyof typeof tables]})`, (err: Error | null) => {
            /* istanbul ignore if */
              if (err != null) {
                throw err
              } else {
                created++
                /* istanbul ignore else */
                if (created === arr.length) {
                  resolve(true)
                  Object.keys(indexes).forEach((table) => {
                    // @ts-expect-error table is defined here
                    indexes[table as Collections].forEach(index => {
                      db.run(`CREATE INDEX i_${table}_${index} ON ${table} (${index})`, (err: Error | null) => {
                        /* istanbul ignore if */
                        if (err != null) console.error(`Index ${index}`, err)
                      })
                    })
                  })
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
