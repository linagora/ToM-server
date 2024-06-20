/* eslint-disable @typescript-eslint/promise-function-async */
import { type TwakeLogger } from '@twake/logger'
import { type Database, type Statement } from 'sqlite3'
import { type Config, type DbGetResult } from '../../types'
import {
  type Collections,
  type ISQLCondition,
  type IdDbBackend
} from '../index'
import createTables from './_createTables'
import SQL from './sql'

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
    >,
    logger: TwakeLogger
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db != null) {
        createTables(
          this,
          tables,
          indexes,
          initializeValues,
          logger,
          resolve,
          reject
        )
      } else {
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
            createTables(
              this,
              tables,
              indexes,
              initializeValues,
              logger,
              resolve,
              reject
            )
          })
          .catch((e) => {
            /* istanbul ignore next */
            throw e
          })
      }
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
  ): Promise<DbGetResult> {
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
          .join(',')}) RETURNING *;`
      )
      stmt.all(
        vals,
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

  update(
    table: string,
    values: Record<string, string | number>,
    field: string,
    value: string | number
  ): Promise<DbGetResult> {
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
        `UPDATE ${table} SET ${names.join(
          '=?,'
        )}=? WHERE ${field}=? RETURNING *;`
      )
      stmt.all(
        vals,
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

  // TODO : Merge update and updateAnd into one function that takes an array of conditions as argument
  updateAnd(
    table: string,
    values: Record<string, string | number>,
    condition1: { field: string; value: string | number },
    condition2: { field: string; value: string | number }
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }
      const names = Object.keys(values)
      const vals = Object.values(values)
      vals.push(condition1.value, condition2.value)

      const setClause = names.map((name) => `${name} = ?`).join(', ')
      const stmt = this.db.prepare(
        `UPDATE ${table} SET ${setClause} WHERE ${condition1.field} = ? AND ${condition2.field} = ? RETURNING *;`
      )

      stmt.all(
        vals,
        (err: string, rows: Array<Record<string, string | number>>) => {
          if (err != null) {
            reject(err)
          } else {
            resolve(rows)
          }
        }
      )

      stmt.finalize((err) => {
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (err) {
          reject(err)
        }
      })
    })
  }

  _get(
    op: string,
    table: string,
    fields?: string[],
    filterFields?: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      } else {
        let condition: string = ''
        const values: string[] = []
        if (fields == null || fields.length === 0) {
          fields = ['*']
        }
        if (filterFields != null) {
          let index = 0
          Object.keys(filterFields)
            .filter(
              (key) =>
                filterFields[key] != null &&
                filterFields[key].toString() !== [].toString()
            )
            .forEach((key) => {
              condition += condition === '' ? 'WHERE ' : ' AND '
              if (Array.isArray(filterFields[key])) {
                condition += `${(filterFields[key] as Array<string | number>)
                  .map((val) => {
                    index++
                    values.push(val.toString())
                    return `${key}${op}$${index}`
                  })
                  .join(' OR ')}`
              } else {
                index++
                values.push(filterFields[key].toString())
                condition += `${key}${op}$${index}`
              }
            })
        }
        if (order != null) condition += ` ORDER BY ${order}`

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore never undefined
        const stmt = this.db.prepare(
          `SELECT ${fields.join(',')} FROM ${table} ${condition}`
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

  get(
    table: string,
    fields?: string[],
    filterFields?: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this._get('=', table, fields, filterFields, order)
  }

  getHigherThan(
    table: Collections,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this._get('>', table, fields, filterFields, order)
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
        stmt.all([value], (err, rows) => {
          /* istanbul ignore if */
          if (err != null) {
            reject(err)
          } else {
            resolve()
          }
        })
        stmt.finalize((err) => {
          reject(err)
        })
      }
    })
  }

  deleteEqualAnd(
    table: Collections,
    condition1: {
      field: string
      value: string | number | Array<string | number>
    },
    condition2: {
      field: string
      value: string | number | Array<string | number>
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      } else {
        const stmt = this.db.prepare(
          `DELETE FROM ${table} WHERE ${condition1.field}=? AND ${condition2.field}=?`
        )
        stmt.all([condition1.value, condition2.value], (err, rows) => {
          /* istanbul ignore if */
          if (err != null) {
            reject(err)
          } else {
            resolve()
          }
        })
        stmt.finalize((err) => {
          reject(err)
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
      stmt.all([value], (err) => {
        /* istanbul ignore if */
        if (err != null) {
          reject(err)
        } else {
          resolve()
        }
      })
      stmt.finalize((err) => {
        reject(err)
      })
    })
  }

  /**
   * Delete from a table when a condition is met.
   *
   * @param {string} table - the table to delete from
   * @param {ISQLCondition | ISQLCondition[]} conditions - the list of filters, operators and values for sql conditions
   */
  deleteWhere(
    table: string,
    conditions: ISQLCondition | ISQLCondition[]
  ): Promise<void> {
    // Adaptation of the method get, with the delete keyword, 'AND' instead of 'OR', and with filters instead of fields
    return new Promise((resolve, reject) => {
      // istanbul ignore if
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      } else {
        if (!Array.isArray(conditions)) conditions = [conditions]

        const values = conditions.map((c) => c.value)
        const filters = conditions.map((c) => c.field)
        const operators = conditions.map((c) => c.operator)

        let condition: string = ''
        if (
          values != null &&
          values.length > 0 &&
          filters.length === values.length
        ) {
          // Verifies that values have at least one element, and as much filter names
          condition = filters
            .map((filt, i) => `${filt}${operators[i] ?? '='}?`)
            .join(' AND ')
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore never undefined
        const stmt = this.db.prepare(`DELETE FROM ${table} WHERE ${condition}`)

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
      }
    })
  }

  close(): void {
    this.db?.close()
  }
}

export default SQLite
