/* eslint-disable @typescript-eslint/promise-function-async */
import { type TwakeLogger } from '@twake/logger'
import { type Database, type Statement } from 'sqlite3'
import { type Config, type DbGetResult } from '../../types'
import { type IdDbBackend } from '../index'
import createTables from './_createTables'
import SQL, { type ISQLCondition } from './sql'

export type SQLiteDatabase = Database

export type SQLiteStatement = Statement

class SQLite<T extends string> extends SQL<T> implements IdDbBackend<T> {
  declare db?: SQLiteDatabase
  createDatabases(
    conf: Config,
    tables: Record<T, string>,
    indexes: Partial<Record<T, string[]>>,
    initializeValues: Partial<
      Record<T, Array<Record<string, string | number>>>
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
      if (this.db == null) {
        this.logger.error('[SQLite][rawQuery] DB not ready')
        reject(new Error('DB not ready'))
        return
      }
      this.logger.debug('[SQLite][rawQuery] Executing query', { query })
      this.db.run(query, (err) => {
        if (err == null) {
          this.logger.debug('[SQLite][rawQuery] Query successful', { query })
          resolve()
        } else {
          this.logger.error('[SQLite][rawQuery] Query failed', {
            query,
            error: err
          })
          reject(err)
        }
      })
    })
  }

  exists(table: T): Promise<number> {
    // @ts-expect-error sqlite_master not listed in Collections
    return this.getCount('sqlite_master', 'name', table)
  }

  insert(
    table: T,
    values: Record<string, string | number>
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        this.logger.error('[SQLite][insert] DB not ready', { table })
        throw new Error('Wait for database to be ready')
      }
      const names: string[] = []
      const vals: Array<string | number> = []
      Object.keys(values).forEach((k) => {
        names.push(k)
        vals.push(values[k])
      })
      const query = `INSERT INTO ${table}(${names.join(',')}) VALUES(${names
        .map((v) => '?')
        .join(',')}) RETURNING *;`
      this.logger.debug('[SQLite][insert] Executing', {
        table,
        fields: names,
        query
      })
      const stmt = this.db.prepare(query)
      stmt.all(
        vals,
        (err: string, rows: Array<Record<string, string | number>>) => {
          /* istanbul ignore if */
          if (err != null) {
            this.logger.error('[SQLite][insert] Failed', {
              table,
              fields: names,
              values: vals,
              query,
              error: err
            })
            reject(err)
          } else {
            this.logger.debug('[SQLite][insert] Successful', {
              table,
              rowCount: rows.length
            })
            resolve(rows)
          }
        }
      )
      stmt.finalize((err) => {
        if (err) {
          this.logger.error('[SQLite][insert] Statement finalize failed', {
            table,
            error: err
          })
          reject(err)
        }
      })
    })
  }

  update(
    table: T,
    values: Record<string, string | number>,
    field: string,
    value: string | number
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        this.logger.error('[SQLite][update] DB not ready', { table, field })
        throw new Error('Wait for database to be ready')
      }
      const names: string[] = []
      const vals: Array<string | number> = []
      Object.keys(values).forEach((k) => {
        names.push(k)
        vals.push(values[k])
      })
      vals.push(value)
      const query = `UPDATE ${table} SET ${names.join(
        '=?,'
      )}=? WHERE ${field}=? RETURNING *;`
      this.logger.debug('[SQLite][update] Executing', {
        table,
        fields: names,
        whereField: field,
        query
      })
      const stmt = this.db.prepare(query)
      stmt.all(
        vals,
        (err: string, rows: Array<Record<string, string | number>>) => {
          /* istanbul ignore if */
          if (err != null) {
            this.logger.error('[SQLite][update] Failed', {
              table,
              fields: names,
              whereField: field,
              query,
              error: err
            })
            reject(err)
          } else {
            this.logger.debug('[SQLite][update] Successful', {
              table,
              rowCount: rows.length
            })
            resolve(rows)
          }
        }
      )
      stmt.finalize((err) => {
        if (err) {
          this.logger.error('[SQLite][update] Statement finalize failed', {
            table,
            error: err
          })
          reject(err)
        }
      })
    })
  }

  // TODO : Merge update and updateAnd into one function that takes an array of conditions as argument
  updateAnd(
    table: T,
    values: Record<string, string | number>,
    condition1: { field: string; value: string | number },
    condition2: { field: string; value: string | number }
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        this.logger.error('[SQLite][updateAnd] DB not ready', {
          table,
          conditions: [condition1.field, condition2.field]
        })
        throw new Error('Wait for database to be ready')
      }
      const names = Object.keys(values)
      const vals = Object.values(values)
      vals.push(condition1.value, condition2.value)

      const setClause = names.map((name) => `${name} = ?`).join(', ')
      const query = `UPDATE ${table} SET ${setClause} WHERE ${condition1.field} = ? AND ${condition2.field} = ? RETURNING *;`
      this.logger.debug('[SQLite][updateAnd] Executing', {
        table,
        fields: names,
        whereFields: [condition1.field, condition2.field],
        query
      })
      const stmt = this.db.prepare(query)

      stmt.all(
        vals,
        (err: string, rows: Array<Record<string, string | number>>) => {
          if (err != null) {
            this.logger.error('[SQLite][updateAnd] Failed', {
              table,
              fields: names,
              whereFields: [condition1.field, condition2.field],
              query,
              error: err
            })
            reject(err)
          } else {
            this.logger.debug('[SQLite][updateAnd] Successful', {
              table,
              rowCount: rows.length
            })
            resolve(rows)
          }
        }
      )

      stmt.finalize((err) => {
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (err) {
          this.logger.error(
            'UPDATE with AND conditions statement finalize failed',
            { table, error: err }
          )
          reject(err)
        }
      })
    })
  }

  // TODO : Merge update and updateAnd into one function that takes an array of conditions as argument
  // Done in Client server - go see updateWithConditions
  updateAnd(
    table: T,
    values: Record<string, string | number>,
    condition1: { field: string; value: string | number },
    condition2: { field: string; value: string | number }
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
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

  _get(
    tables: T[],
    fields?: string[],
    op1?: string,
    filterFields1?: Record<string, string | number | Array<string | number>>,
    op2?: string,
    linkop1?: string,
    filterFields2?: Record<string, string | number | Array<string | number>>,
    op3?: string,
    linkop2?: string,
    filterFields3?: Record<string, string | number | Array<string | number>>,
    joinFields?: Record<string, string>,
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
        } else {
          // Generate aliases for fields containing periods
          fields = fields.map((field) => {
            if (field.includes('.')) {
              const alias = field.replace(/\./g, '_')
              return `${field} AS ${alias}`
            }
            return field
          })
        }

        let index: number = 0

        const buildCondition = (
          op: string,
          filterFields: Record<string, string | number | Array<string | number>>
        ): string => {
          let localCondition = ''

          Object.keys(filterFields)
            .filter(
              (key) =>
                filterFields[key] != null &&
                filterFields[key].toString() !== [].toString()
            )
            .forEach((key) => {
              localCondition += localCondition !== '' ? ' AND ' : ''
              if (Array.isArray(filterFields[key])) {
                localCondition += `(${(
                  filterFields[key] as Array<string | number>
                )
                  .map((val) => {
                    index++
                    values.push(val.toString())
                    return `${key}${op}$${index}`
                  })
                  .join(' OR ')})`
              } else {
                index++
                values.push(filterFields[key].toString())
                localCondition += `${key}${op}$${index}`
              }
            })
          return localCondition
        }

        const condition1 =
          op1 != null &&
          filterFields1 != null &&
          Object.keys(filterFields1).length > 0
            ? buildCondition(op1, filterFields1)
            : ''
        const condition2 =
          op2 != null &&
          linkop1 != null &&
          filterFields2 != null &&
          Object.keys(filterFields2).length > 0
            ? buildCondition(op2, filterFields2)
            : ''
        const condition3 =
          op3 != null &&
          linkop2 != null &&
          filterFields3 != null &&
          Object.keys(filterFields3).length > 0
            ? buildCondition(op3, filterFields3)
            : ''

        condition += condition1 !== '' ? 'WHERE ' + condition1 : ''
        condition +=
          condition2 !== ''
            ? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              (condition !== '' ? ` ${linkop1} ` : 'WHERE ') + condition2
            : ''
        condition +=
          condition3 !== ''
            ? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              (condition !== '' ? ` ${linkop2} ` : 'WHERE ') + condition3
            : ''

        if (joinFields != null) {
          let joinCondition = ''
          Object.keys(joinFields)
            .filter(
              (key) =>
                joinFields[key] != null &&
                joinFields[key].toString() !== [].toString()
            )
            .forEach((key) => {
              joinCondition += joinCondition !== '' ? ' AND ' : ''
              joinCondition += `${key}=${joinFields[key]}`
            })
          condition += condition !== '' ? ' AND ' : 'WHERE '
          condition += joinCondition
        }

        if (order != null) condition += ` ORDER BY ${order}`

        const query = `SELECT ${fields.join(',')} FROM ${tables.join(
          ','
        )} ${condition}`
        this.logger.debug('[SQLite][_get] Executing SELECT', {
          tables,
          fields,
          condition,
          query
        })
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore never undefined
        const stmt = this.db.prepare(query)
        stmt.all(
          values,
          (err: string, rows: Array<Record<string, string | number>>) => {
            /* istanbul ignore if */
            if (err != null) {
              this.logger.error('[SQLite][_get] SELECT failed', {
                tables,
                fields,
                condition,
                query,
                error: err
              })
              reject(err)
            } else {
              this.logger.debug('[SQLite][_get] SELECT successful', {
                tables,
                rowCount: rows.length
              })
              resolve(rows)
            }
          }
        )
        stmt.finalize((err) => {
          if (err) {
            this.logger.error('[SQLite][_get] Statement finalize failed', {
              tables,
              error: err
            })
            reject(err)
          }
        })
      }
    })
  }

  get(
    table: T,
    fields?: string[],
    filterFields?: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this._get(
      [table],
      fields,
      '=',
      filterFields,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      order
    )
  }

  getJoin(
    tables: T[],
    fields?: string[],
    filterFields?: Record<string, string | number | Array<string | number>>,
    joinFields?: Record<string, string>,
    order?: string
  ): Promise<DbGetResult> {
    return this._get(
      tables,
      fields,
      '=',
      filterFields,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      joinFields,
      order
    )
  }

  getJoin(
    tables: Array<T>,
    fields?: string[],
    filterFields?: Record<string, string | number | Array<string | number>>,
    joinFields?: Record<string, string>,
    order?: string
  ): Promise<DbGetResult> {
    return this._get(
      tables,
      fields,
      '=',
      filterFields,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      joinFields,
      order
    )
  }

  getHigherThan(
    table: T,
    fields?: string[],
    filterFields?: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this._get(
      [table],
      fields,
      '>',
      filterFields,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      order
    )
  }

  getWhereEqualOrDifferent(
    table: T,
    fields?: string[],
    filterFields1?: Record<string, string | number | Array<string | number>>,
    filterFields2?: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this._get(
      [table],
      fields,
      '=',
      filterFields1,
      '<>',
      ' OR ',
      filterFields2,
      undefined,
      undefined,
      undefined,
      undefined,
      order
    )
  }

  getWhereEqualAndHigher(
    table: T,
    fields?: string[],
    filterFields1?: Record<string, string | number | Array<string | number>>,
    filterFields2?: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this._get(
      [table],
      fields,
      '=',
      filterFields1,
      '>',
      ' AND ',
      filterFields2,
      undefined,
      undefined,
      undefined,
      undefined,
      order
    )
  }

  _getMinMax(
    minmax: 'MIN' | 'MAX',
    tables: T[],
    targetField: string,
    fields?: string[],
    op1?: string,
    filterFields1?: Record<string, string | number | Array<string | number>>,
    op2?: string,
    linkop?: string,
    filterFields2?: Record<string, string | number | Array<string | number>>,
    joinFields?: Record<string, string>,
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
        } else {
          // Generate aliases for fields containing periods
          fields = fields.map((field) => {
            if (field.includes('.')) {
              const alias = field.replace(/\./g, '_')
              return `${field} AS ${alias}`
            }
            return field
          })
        }
        const targetFieldAlias: string = targetField.replace(/\./g, '_')

        let index: number = 0

        const buildCondition = (
          op: string,
          filterFields: Record<string, string | number | Array<string | number>>
        ): string => {
          let localCondition = ''

          Object.keys(filterFields)
            .filter(
              (key) =>
                filterFields[key] != null &&
                filterFields[key].toString() !== [].toString()
            )
            .forEach((key) => {
              localCondition += localCondition !== '' ? ' AND ' : ''
              if (Array.isArray(filterFields[key])) {
                localCondition += `(${(
                  filterFields[key] as Array<string | number>
                )
                  .map((val) => {
                    index++
                    values.push(val.toString())
                    return `${key}${op}$${index}`
                  })
                  .join(' OR ')})`
              } else {
                index++
                values.push(filterFields[key].toString())
                localCondition += `${key}${op}$${index}`
              }
            })
          return localCondition
        }

        const condition1 =
          op1 != null &&
          filterFields1 != null &&
          Object.keys(filterFields1).length > 0
            ? buildCondition(op1, filterFields1)
            : ''
        const condition2 =
          op2 != null &&
          linkop != null &&
          filterFields2 != null &&
          Object.keys(filterFields2).length > 0
            ? buildCondition(op2, filterFields2)
            : ''

        condition += condition1 !== '' ? 'WHERE ' + condition1 : ''
        condition +=
          condition2 !== ''
            ? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              (condition !== '' ? ` ${linkop} ` : 'WHERE ') + condition2
            : ''

        if (joinFields != null) {
          let joinCondition = ''
          Object.keys(joinFields)
            .filter(
              (key) =>
                joinFields[key] != null &&
                joinFields[key].toString() !== [].toString()
            )
            .forEach((key) => {
              joinCondition += joinCondition !== '' ? ' AND ' : ''
              joinCondition += `${key}=${joinFields[key]}`
            })
          condition += condition !== '' ? ' AND ' : 'WHERE '
          condition += joinCondition
        }

        if (order != null) condition += ` ORDER BY ${order}`

        const query = `SELECT ${fields.join(
          ','
        )}, ${minmax}(${targetField}) AS max_${targetFieldAlias} FROM ${tables.join(
          ','
        )} ${condition} HAVING COUNT(*) > 0` // HAVING COUNT(*) > 0 is to avoid returning a row with NULL values
        this.logger.debug(`Executing ${minmax} query`, {
          tables,
          targetField,
          fields,
          condition,
          query
        })
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore never undefined
        const stmt = this.db.prepare(query)
        stmt.all(
          values,
          (err: string, rows: Array<Record<string, string | number>>) => {
            /* istanbul ignore if */
            if (err != null) {
              this.logger.error(`${minmax} query failed`, {
                tables,
                targetField,
                fields,
                condition,
                query,
                error: err
              })
              reject(err)
            } else {
              this.logger.debug(`${minmax} query successful`, {
                tables,
                rowCount: rows.length
              })
              resolve(rows)
            }
          }
        )
        stmt.finalize((err) => {
          if (err) {
            this.logger.error(`${minmax} statement finalize failed`, {
              tables,
              error: err
            })
            reject(err)
          }
        })
      }
    })
  }

  getMaxWhereEqual(
    table: T,
    targetField: string,
    fields?: string[],
    filterFields?: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this._getMinMax(
      'MAX',
      [table],
      targetField,
      fields,
      '=',
      filterFields,
      undefined,
      undefined,
      undefined,
      undefined,
      order
    )
  }

  getMaxWhereEqualAndLower(
    table: T,
    targetField: string,
    fields: string[],
    filterFields1?: Record<string, string | number | Array<string | number>>,
    filterFields2?: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this._getMinMax(
      'MAX',
      [table],
      targetField,
      fields,
      '=',
      filterFields1,
      '<',
      ' AND ',
      filterFields2,
      undefined,
      order
    )
  }

  getMinWhereEqualAndHigher(
    table: T,
    targetField: string,
    fields?: string[],
    filterFields1?: Record<string, string | number | Array<string | number>>,
    filterFields2?: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this._getMinMax(
      'MIN',
      [table],
      targetField,
      fields,
      '=',
      filterFields1,
      '>',
      ' AND ',
      filterFields2,
      undefined,
      order
    )
  }

  getMaxWhereEqualAndLowerJoin(
    tables: T[],
    targetField: string,
    fields: string[],
    filterFields1?: Record<string, string | number | Array<string | number>>,
    filterFields2?: Record<string, string | number | Array<string | number>>,
    joinFields?: Record<string, string>,
    order?: string
  ): Promise<DbGetResult> {
    return this._getMinMax(
      'MAX',
      tables,
      targetField,
      fields,
      '=',
      filterFields1,
      '<',
      ' AND ',
      filterFields2,
      joinFields,
      order
    )
  }

  match(
    table: T,
    fields: string[],
    searchFields: string[],
    value: string | number,
    order?: string
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        this.logger.error('[SQLite][match] DB not ready', { table })
        reject(new Error('Wait for database to be ready'))
      } else {
        if (typeof searchFields !== 'object') searchFields = [searchFields]
        if (typeof fields !== 'object') fields = [fields]
        if (fields.length === 0) fields = ['*']
        const values = searchFields.map(() => `%${value}%`)
        let condition = searchFields.map((f) => `${f} LIKE ?`).join(' OR ')
        if (order != null) condition += `ORDER BY ${order}`
        const query = `SELECT ${fields.join(
          ','
        )} FROM ${table} WHERE ${condition}`
        this.logger.debug('[SQLite][match] Executing LIKE query', {
          table,
          searchFields,
          value,
          fields,
          query
        })
        const stmt = this.db.prepare(query)
        stmt.all(
          values,
          (err: string, rows: Array<Record<string, string | number>>) => {
            /* istanbul ignore if */
            if (err != null) {
              this.logger.error('[SQLite][match] Query failed', {
                table,
                searchFields,
                value,
                query,
                error: err
              })
              reject(err)
            } else {
              this.logger.debug('[SQLite][match] Query successful', {
                table,
                rowCount: rows.length
              })
              resolve(rows)
            }
          }
        )
        stmt.finalize((err) => {
          if (err) {
            this.logger.error('[SQLite][match] Statement finalize failed', {
              table,
              error: err
            })
            reject(err)
          }
        })
      }
    })
  }

  deleteEqual(table: T, field: string, value: string | number): Promise<void> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        this.logger.error('[SQLite][deleteEqual] DB not ready', {
          table,
          field
        })
        reject(new Error('Wait for database to be ready'))
      } else {
        const query = `DELETE FROM ${table} WHERE ${field}=?`
        this.logger.debug('[SQLite][deleteEqual] Executing', {
          table,
          field,
          query
        })
        const stmt = this.db.prepare(query)
        stmt.all([value], (err, rows) => {
          /* istanbul ignore if */
          if (err != null) {
            this.logger.error('DELETE failed', {
              table,
              field,
              query,
              error: err
            })
            reject(err)
          } else {
            this.logger.debug('[SQLite][deleteEqual] Successful', {
              table,
              field
            })
            resolve()
          }
        })
        stmt.finalize((err) => {
          if (err) {
            this.logger.error(
              '[SQLite][deleteEqual] Statement finalize failed',
              {
                table,
                error: err
              }
            )
            reject(err)
          }
        })
      }
    })
  }

  deleteEqualAnd(
    table: T,
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
        this.logger.error('[SQLite][deleteEqualAnd] DB not ready', { table })
        reject(new Error('Wait for database to be ready'))
      } else {
        const query = `DELETE FROM ${table} WHERE ${condition1.field}=? AND ${condition2.field}=?`
        this.logger.debug('[SQLite][deleteEqualAnd] Executing', {
          table,
          conditions: [condition1.field, condition2.field],
          query
        })
        const stmt = this.db.prepare(query)
        stmt.all([condition1.value, condition2.value], (err, rows) => {
          /* istanbul ignore if */
          if (err != null) {
            this.logger.error('[SQLite][deleteEqualAnd] Failed', {
              table,
              conditions: [condition1.field, condition2.field],
              query,
              error: err
            })
            reject(err)
          } else {
            this.logger.debug('[SQLite][deleteEqualAnd] Successful', {
              table
            })
            resolve()
          }
        })
        stmt.finalize((err) => {
          if (err) {
            this.logger.error(
              'DELETE with AND conditions statement finalize failed',
              { table, error: err }
            )
            reject(err)
          }
        })
      }
    })
  }

  deleteEqualAnd(
    table: T,
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
    table: T,
    field: string,
    value: string | number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        this.logger.error('[SQLite][deleteLowerThan] DB not ready', {
          table,
          field
        })
        throw new Error('Wait for database to be ready')
      }
      const query = `DELETE FROM ${table} WHERE ${field}<?`
      this.logger.debug('[SQLite][deleteLowerThan] Executing', {
        table,
        field,
        query
      })
      const stmt = this.db.prepare(query)
      stmt.all([value], (err) => {
        /* istanbul ignore if */
        if (err != null) {
          this.logger.error('[SQLite][deleteLowerThan] Failed', {
            table,
            field,
            query,
            error: err
          })
          reject(err)
        } else {
          this.logger.debug('[SQLite][deleteLowerThan] Successful', {
            table,
            field
          })
          resolve()
        }
      })
      stmt.finalize((err) => {
        if (err) {
          this.logger.error(
            'DELETE with < condition statement finalize failed',
            { table, error: err }
          )
          reject(err)
        }
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
    table: T,
    conditions: ISQLCondition | ISQLCondition[]
  ): Promise<void> {
    // Adaptation of the method get, with the delete keyword, 'AND' instead of 'OR', and with filters instead of fields
    return new Promise((resolve, reject) => {
      // istanbul ignore if
      if (this.db == null) {
        this.logger.error('[SQLite][deleteWhere] DB not ready', { table })
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

        const query = `DELETE FROM ${table} WHERE ${condition}`
        this.logger.debug('[SQLite][deleteWhere] Executing', {
          table,
          conditions: filters,
          operators,
          query
        })
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore never undefined
        const stmt = this.db.prepare(query)

        stmt.all(
          values, // The statement fills the values properly.
          (err: string) => {
            /* istanbul ignore if */
            if (err != null) {
              this.logger.error('[SQLite][deleteWhere] Failed', {
                table,
                conditions: filters,
                operators,
                values,
                query,
                error: err
              })
              reject(err)
            } else {
              this.logger.debug('[SQLite][deleteWhere] Successful', {
                table
              })
              resolve()
            }
          }
        )
        stmt.finalize((err) => {
          if (err) {
            this.logger.error(
              'DELETE with WHERE conditions statement finalize failed',
              { table, error: err }
            )
            reject(err)
          }
        })
      }
    })
  }

  close(): void {
    this.db?.close()
  }
}

export default SQLite
