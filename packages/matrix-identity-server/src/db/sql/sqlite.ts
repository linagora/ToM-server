import { type Database, type Statement } from 'sqlite3'
import { type Collections, type IdDbBackend } from '../index'
import SQL from './sql'
import createTables from './_createTables'
import { type Config } from '../..'

export type SQLiteDatabase = Database

export type SQLiteStatement = Statement

class SQLite extends SQL implements IdDbBackend {
  declare db?: SQLiteDatabase
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(
    conf: Config,
    tables: Record<Collections, string>,
    indexes: Partial<Record<Collections, string[]>>,
    initializeValues: Partial<
      Record<Collections, Array<Record<string, string | number>>>
    >
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      import('sqlite3')
        .then((sqlite3) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
          // @ts-ignore
          if (sqlite3.Database == null) sqlite3 = sqlite3.default
          const db = (this.db = new sqlite3.Database(conf.database_host))
          /* istanbul ignore if */
          if (db == null) {
            throw new Error('Database not created')
          }
          createTables(this, tables, indexes, initializeValues, resolve, reject)
        })
        .catch((e) => {
          /* istanbul ignore next */
          throw e
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  rawQuery(query: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db?.run(query, (err) => {
        /* istanbul ignore else */
        if (err == null) {
          resolve()
        } else {
          reject(err)
        }
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  exists(table: string): Promise<number> {
    // @ts-expect-error sqlite_master not listed in Collections
    return this.getCount('sqlite_master', 'name', table)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  insert(
    table: string,
    values: Record<string, string | number>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }
      const names: string[] = []
      const vals: Array<string | number> = []
      Object.keys(values).forEach((k) => {
        names.push(k)
        vals.push(values[k])
      })
      const stmt = this.db.prepare(
        `INSERT INTO ${table}(${names.join(',')}) VALUES(${names
          .map((v) => '?')
          .join(',')})`
      )
      stmt.run(vals).finalize(() => {
        resolve()
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  update(
    table: string,
    values: Record<string, string | number>,
    field: string,
    value: string | number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }
      const names: string[] = []
      const vals: Array<string | number> = []
      Object.keys(values).forEach((k) => {
        names.push(k)
        vals.push(values[k])
      })
      vals.push(value)
      const stmt = this.db.prepare(
        `UPDATE ${table} SET ${names.join('=?,')}=? WHERE ${field}=?`
      )
      stmt.run(vals).finalize(() => {
        resolve()
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  get(
    table: string,
    fields?: string[],
    field?: string,
    value?: string | number | string[]
  ): Promise<Array<Record<string, string | number>>> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      }
      let condition: string = ''
      if (fields == null || fields.length === 0) {
        fields = ['*']
      }
      if (field != null && value != null) {
        if (typeof value === 'object') {
          condition = 'WHERE ' + value.map((val) => `${field}=?`).join(' OR ')
        } else {
          condition = 'WHERE ' + `${field}=?`
        }
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore never undefined
      const stmt = this.db.prepare(
        `SELECT ${fields.join(',')} FROM ${table} ${condition}`
      )
      stmt.all(
        value,
        (err: string, rows: Array<Record<string, string | number>>) => {
          /* istanbul ignore if */
          if (err != null) {
            reject(err)
          } else {
            resolve(rows)
          }
        }
      )
      stmt.finalize((err) => {
        reject(err)
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  match(
    table: string,
    fields: string[],
    searchFields: string[],
    value: string | number
  ): Promise<Array<Record<string, string | number>>> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      } else {
        if (typeof searchFields !== 'object') searchFields = [searchFields]
        if (typeof fields !== 'object') fields = [fields]
        if (fields.length === 0) fields = ['*']
        const values = searchFields.map(() => `%${value}%`)
        const condition = searchFields.map((f) => `${f} LIKE ?`).join(' OR ')
        const stmt = this.db.prepare(
          `SELECT ${fields.join(',')} FROM ${table} WHERE ${condition}`
        )
        stmt.all(
          values,
          (err: string, rows: Array<Record<string, string | number>>) => {
            /* istanbul ignore if */
            if (err != null) {
              reject(err)
            } else {
              resolve(rows)
            }
          }
        )
        stmt.finalize((err) => {
          reject(err)
        })
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteEqual(
    table: string,
    field: string,
    value: string | number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      } else {
        const stmt = this.db.prepare(`DELETE FROM ${table} WHERE ${field}=?`)
        stmt.run(value, (err: string) => {
          /* istanbul ignore if */
          if (err != null) {
            reject(err)
          } else {
            resolve()
          }
        })
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteLowerThan(
    table: string,
    field: string,
    value: string | number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }
      const stmt = this.db.prepare(`DELETE FROM ${table} WHERE ${field}<?`)
      stmt.run(value, (err: string) => {
        /* istanbul ignore if */
        if (err != null) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  close(): void {
    // this.db?.close()
  }
}

export default SQLite
