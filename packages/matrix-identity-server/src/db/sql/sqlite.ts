/* eslint-disable @typescript-eslint/promise-function-async */
import { type Database, type Statement } from 'sqlite3'
import { type Collections, type IdDbBackend } from '../index'
import SQL from './sql'
import createTables from './_createTables'
import { type DbGetResult, type Config } from '../../types'

export type SQLiteDatabase = Database

export type SQLiteStatement = Statement

class SQLite extends SQL implements IdDbBackend {
  declare db?: SQLiteDatabase
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

  exists(table: string): Promise<number> {
    // @ts-expect-error sqlite_master not listed in Collections
    return this.getCount('sqlite_master', 'name', table)
  }

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

  _get(
    op: string,
    table: string,
    fields?: string[],
    field?: string,
    value?: string | number | Array<string | number>,
    order?: string
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (typeof value !== 'object') {
        value = value != null ? [value] : []
      }
      /* istanbul ignore if */
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      }
      let condition: string = ''
      if (fields == null || fields.length === 0) {
        fields = ['*']
      }
      if (field != null && value != null && value.length > 0) {
        condition = 'WHERE ' + value.map((val) => `${field}${op}?`).join(' OR ')
      }
      if (order != null) condition += `ORDER BY ${order}`

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

  get(
    table: string,
    fields?: string[],
    field?: string,
    value?: string | number | Array<string | number>,
    order?: string
  ): Promise<DbGetResult> {
    return this._get('=', table, fields, field, value, order)
  }

  getHigherThan(
    table: Collections,
    fields: string[],
    field: string,
    value: string | number | string[],
    order?: string
  ): Promise<DbGetResult> {
    return this._get('>', table, fields, field, value, order)
  }

  match(
    table: string,
    fields: string[],
    searchFields: string[],
    value: string | number,
    order?: string
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      } else {
        if (typeof searchFields !== 'object') searchFields = [searchFields]
        if (typeof fields !== 'object') fields = [fields]
        if (fields.length === 0) fields = ['*']
        const values = searchFields.map(() => `%${value}%`)
        let condition = searchFields.map((f) => `${f} LIKE ?`).join(' OR ')
        if (order != null) condition += `ORDER BY ${order}`
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
        stmt.run(value).finalize((err) => {
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
      stmt.run(value).finalize((err) => {
        /* istanbul ignore if */
        if (err != null) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Delete from a table when a condition is met.
   *
   * @param {string} table - the table to delete from
   * @param {string | string[]} filters - the list of filters
   * @param {string | number | Array<string | number>} values - the filter values
   */
  deleteWhere(
    table: string,
    filters: string | string[],
    values: string | number | Array<string | number>
  ): Promise<void> {
    // Adaptation of the method get, with the delete keyword, 'AND' instead of 'OR', and with filters instead of fields
    return new Promise((resolve, reject) => {
      if (typeof values !== 'object') {
        values = [values]
      }

      if (typeof filters !== 'object') {
        filters = [filters]
      }

      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      }

      let condition: string = ''
      if (
        values != null &&
        values.length > 0 &&
        filters.length === values.length
      ) {
        // Verifies that values have at least one element, and as much filter names
        condition = 'WHERE ' + filters.map((filt) => `${filt}=?`).join(' AND ')
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore never undefined
      const stmt = this.db.prepare(`DELETE FROM ${table} ${condition}`)

      stmt.all(
        values, // The statement fills the values properly.
        (err: string) => {
          /* istanbul ignore if */
          if (err != null) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
      stmt.finalize((err) => {
        reject(err)
      })
    })
  }

  close(): void {
    this.db?.close()
  }
}

export default SQLite
