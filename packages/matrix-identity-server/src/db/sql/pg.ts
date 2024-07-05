/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/promise-function-async */
/* istanbul ignore file */
import { type TwakeLogger } from '@twake/logger'
import { type ClientConfig, type Pool as PgPool } from 'pg'
import { type IdDbBackend } from '..'
import { type Config, type DbGetResult } from '../../types'
import createTables from './_createTables'
import SQL, { type ISQLCondition } from './sql'

export type PgDatabase = PgPool

class Pg<T extends string> extends SQL<T> implements IdDbBackend<T> {
  declare db?: PgDatabase
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
        import('pg')
          .then((pg) => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
            // @ts-ignore
            if (pg.Database == null) pg = pg.default
            if (
              conf.database_host == null ||
              conf.database_user == null ||
              conf.database_password == null ||
              conf.database_name == null
            ) {
              throw new Error(
                'database_name, database_user and database_password are required when using Postgres'
              )
            }
            const opts: ClientConfig = {
              host: conf.database_host,
              user: conf.database_user,
              password: conf.database_password,
              database: conf.database_name,
              ssl: conf.database_ssl
            }
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (conf.database_host.match(/^(.*):(\d+)/)) {
              opts.host = RegExp.$1
              opts.port = parseInt(RegExp.$2)
            }
            try {
              this.db = new pg.Pool(opts)
              createTables(
                this,
                tables,
                indexes,
                initializeValues,
                logger,
                resolve,
                reject
              )
            } catch (e) {
              logger.error('Unable to connect to Pg database')
              reject(e)
            }
          })
          .catch((e) => {
            logger.error('Unable to load pg module', e)
            reject(e)
          })
      }
    })
  }

  rawQuery(query: string): Promise<any> {
    if (this.db == null) {
      this.logger.error('[Pg][rawQuery] DB not ready')
      return Promise.reject(new Error('DB not ready'))
    }
    this.logger.debug('[Pg][rawQuery] Executing query', { query })
    return this.db.query(query).catch((err) => {
      this.logger.error('[Pg][rawQuery] Query failed', { query, error: err })
      throw err
    })
  }

  exists(table: T): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.db != null) {
        const query = `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename='${table.toLowerCase()}')`
        this.logger.debug('[Pg][exists] Checking table', { table })
        this.db.query(query, (err, res) => {
          if (err == null) {
            this.logger.debug('[Pg][exists] Check completed', {
              table,
              exists: res.rows[0].exists
            })
            resolve(res.rows[0].exists)
          } else {
            this.logger.warn('[Pg][exists] Check error, assuming false', {
              table,
              error: err
            })
            resolve(false)
          }
        })
      } else {
        this.logger.error('[Pg][exists] DB not ready', { table })
        reject(new Error('DB not ready'))
      }
    })
  }

  insert(
    table: T,
    values: Record<string, string | number>
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        this.logger.error('[Pg][insert] DB not ready', { table })
        throw new Error('Wait for database to be ready')
      }
      const names: string[] = []
      const vals:
        | (string[] & Array<string | number>)
        | (number[] & Array<string | number>) = []
      Object.keys(values).forEach((k) => {
        names.push(k)
        vals.push(values[k])
      })
      const query = `INSERT INTO ${table}(${names.join(',')}) VALUES(${names
        .map((v, i) => `$${i + 1}`)
        .join(',')}) RETURNING *;`
      this.logger.debug('[Pg][insert] Executing', {
        table,
        fields: names,
        query
      })
      this.db.query(query, vals, (err, rows) => {
        if (err) {
          this.logger.error('[Pg][insert] Failed', {
            table,
            fields: names,
            values: vals,
            query,
            error: err
          })
          reject(err)
        } else {
          this.logger.debug('[Pg][insert] Successful', {
            table,
            rowCount: rows.rows.length
          })
          resolve(rows.rows)
        }
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
        this.logger.error('[Pg][update] DB not ready', { table, field })
        reject(new Error('Wait for database to be ready'))
      } else {
        const names: string[] = []
        const vals:
          | (string[] & Array<string | number>)
          | (number[] & Array<string | number>) = []
        Object.keys(values).forEach((k) => {
          names.push(k)
          vals.push(values[k])
        })
        vals.push(value)
        const query = `UPDATE ${table} SET ${names
          .map((name, i) => `${name}=$${i + 1}`)
          .join(',')} WHERE ${field}=$${vals.length} RETURNING *;`
        this.logger.debug('[Pg][update] Executing', {
          table,
          fields: names,
          whereField: field,
          query
        })
        this.db.query(query, vals, (err, rows) => {
          if (err) {
            this.logger.error('[Pg][update] Failed', {
              table,
              fields: names,
              whereField: field,
              query,
              error: err
            })
            reject(err)
          } else {
            this.logger.debug('[Pg][update] Successful', {
              table,
              rowCount: rows.rows.length
            })
            resolve(rows.rows)
          }
        })
      }
    })
  }

  updateAnd(
    table: T,
    values: Record<string, string | number>,
    condition1: { field: string; value: string | number },
    condition2: { field: string; value: string | number }
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        this.logger.error('[Pg][updateAnd] DB not ready', {
          table,
          conditions: [condition1.field, condition2.field]
        })
        reject(new Error('Wait for database to be ready'))
      } else {
        const names: string[] = []
        const vals:
          | (string[] & Array<string | number>)
          | (number[] & Array<string | number>) = []
        Object.keys(values).forEach((k) => {
          names.push(k)
          vals.push(values[k])
        })
        vals.push(condition1.value, condition2.value)
        const query = `UPDATE ${table} SET ${names
          .map((name, i) => `${name}=$${i + 1}`)
          .join(',')} WHERE ${condition1.field}=$${vals.length - 1} AND ${
          condition2.field
        }=$${vals.length} RETURNING *;`
        this.logger.debug('[Pg][updateAnd] Executing', {
          table,
          fields: names,
          whereFields: [condition1.field, condition2.field],
          query
        })
        this.db.query(query, vals, (err, rows) => {
          if (err) {
            this.logger.error('[Pg][updateAnd] Failed', {
              table,
              fields: names,
              whereFields: [condition1.field, condition2.field],
              query,
              error: err
            })
            reject(err)
          } else {
            this.logger.debug('[Pg][updateAnd] Successful', {
              table,
              rowCount: rows.rows.length
            })
            resolve(rows.rows)
          }
        })
      }
    })
  }

  updateAnd(
    table: T,
    values: Record<string, string | number>,
    condition1: { field: string; value: string | number },
    condition2: { field: string; value: string | number }
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      } else {
        const names: string[] = []
        const vals:
          | (string[] & Array<string | number>)
          | (number[] & Array<string | number>) = []
        Object.keys(values).forEach((k) => {
          names.push(k)
          vals.push(values[k])
        })
        vals.push(condition1.value, condition2.value)
        this.db.query(
          `UPDATE ${table} SET ${names
            .map((name, i) => `${name}=$${i + 1}`)
            .join(',')} WHERE ${condition1.field}=$${vals.length - 1} AND ${
            condition2.field
          }=$${vals.length} RETURNING *;`,
          vals,
          (err, rows) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            err ? reject(err) : resolve(rows.rows)
          }
        )
      }
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
                joinFields[key] != null &&
                joinFields[key].toString() !== [].toString()
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
        this.logger.debug('[Pg][_get] Executing SELECT', {
          tables,
          fields,
          condition,
          query
        })
        this.db.query(query, values, (err: any, rows: any) => {
          if (err) {
            this.logger.error('[Pg][_get] SELECT failed', {
              tables,
              fields,
              condition,
              query,
              error: err
            })
            reject(err)
          } else {
            this.logger.debug('[Pg][_get] SELECT successful', {
              tables,
              rowCount: rows.rows.length
            })
            resolve(rows.rows)
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
      '=',
      undefined,
      undefined,
      undefined,
      undefined,
      fields,
      filterFields,
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

        let index = 0

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
              (condition ? ` ${linkop} ` : 'WHERE ') + condition2
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
        this.logger.debug(`[Pg][_getMinMax] Executing ${minmax} query`, {
          tables,
          targetField,
          fields,
          condition,
          query
        })
        this.db.query(query, values, (err, rows) => {
          if (err) {
            this.logger.error(`[Pg][_getMinMax] ${minmax} query failed`, {
              tables,
              targetField,
              fields,
              condition,
              query,
              error: err
            })
            reject(err)
          } else {
            this.logger.debug(`[Pg][_getMinMax] ${minmax} query successful`, {
              tables,
              rowCount: rows.rows.length
            })
            resolve(rows.rows)
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
    fields?: string[],
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
        this.logger.error('[Pg][match] DB not ready', { table })
        reject(new Error('Wait for database to be ready'))
      } else {
        if (typeof searchFields !== 'object') searchFields = [searchFields]
        if (typeof fields !== 'object') fields = [fields]
        if (fields.length === 0) fields = ['*']
        const values = searchFields.map(() => (value ? `%${value}%` : '%'))
        let condition = searchFields
          .map((f, i) => `${f} LIKE $${i + 1}`)
          .join(' OR ')
        if (order != null) condition += ` ORDER BY ${order}`

        const query = `SELECT ${fields.join(
          ','
        )} FROM ${table} WHERE ${condition}`
        this.logger.debug('[Pg][match] Executing LIKE query', {
          table,
          searchFields,
          value,
          fields,
          query
        })
        this.db.query(query, values, (err, rows) => {
          if (err) {
            this.logger.error('[Pg][match] Query failed', {
              table,
              searchFields,
              value,
              query,
              error: err
            })
            reject(err)
          } else {
            this.logger.debug('[Pg][match] Query successful', {
              table,
              rowCount: rows.rows.length
            })
            resolve(rows.rows)
          }
        })
      }
    })
  }

  deleteEqual(table: T, field: string, value: string | number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db == null) {
        this.logger.error('[Pg][deleteEqual] DB not ready', { table, field })
        reject(new Error('DB not ready'))
      } else {
        if (
          !field ||
          field.length === 0 ||
          !value ||
          value.toString().length === 0
        ) {
          this.logger.error('[Pg][deleteEqual] Invalid parameters', {
            table,
            field,
            value
          })
          reject(
            new Error(`Bad deleteEqual call, field: ${field}, value: ${value}`)
          )
          return
        }
        const query = `DELETE FROM ${table} WHERE ${field}=$1`
        this.logger.debug('[Pg][deleteEqual] Executing', {
          table,
          field,
          query
        })
        this.db.query(
          query,
          [value] as
            | (string[] & Array<string | number>)
            | (number[] & Array<string | number>),
          (err, rows) => {
            if (err) {
              this.logger.error('[Pg][deleteEqual] Failed', {
                table,
                field,
                query,
                error: err
              })
              reject(err)
            } else {
              this.logger.debug('[Pg][deleteEqual] Successful', {
                table,
                field
              })
              resolve()
            }
          }
        )
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
      if (this.db == null) {
        this.logger.error('[Pg][deleteEqualAnd] DB not ready', { table })
        reject(new Error('DB not ready'))
      } else {
        if (
          !condition1.field ||
          condition1.field.length === 0 ||
          !condition1.value ||
          condition1.value.toString().length === 0 ||
          !condition2.field ||
          condition2.field.length === 0 ||
          !condition2.value ||
          condition2.value.toString().length === 0
        ) {
          this.logger.error('[Pg][deleteEqualAnd] Invalid parameters', {
            table,
            condition1: { field: condition1.field, value: condition1.value },
            condition2: { field: condition2.field, value: condition2.value }
          })
          reject(
            new Error(
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `Bad deleteAnd call, conditions: ${condition1.field}=${condition1.value}, ${condition2.field}=${condition2.value}`
            )
          )
          return
        }
        const query = `DELETE FROM ${table} WHERE ${condition1.field}=$1 AND ${condition2.field}=$2`
        this.logger.debug('[Pg][deleteEqualAnd] Executing', {
          table,
          conditions: [condition1.field, condition2.field],
          query
        })
        this.db.query(
          query,
          [condition1.value, condition2.value] as
            | (string[] & Array<string | number>)
            | (number[] & Array<string | number>),
          (err) => {
            if (err) {
              this.logger.error('[Pg][deleteEqualAnd] Failed', {
                table,
                conditions: [condition1.field, condition2.field],
                query,
                error: err
              })
              reject(err)
            } else {
              this.logger.debug('[Pg][deleteEqualAnd] Successful', {
                table
              })
              resolve()
            }
          }
        )
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
      if (this.db == null) {
        reject(new Error('DB not ready'))
      } else {
        if (
          !condition1.field ||
          condition1.field.length === 0 ||
          !condition1.value ||
          condition1.value.toString().length === 0 ||
          !condition2.field ||
          condition2.field.length === 0 ||
          !condition2.value ||
          condition2.value.toString().length === 0
        ) {
          reject(
            new Error(
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `Bad deleteAnd call, conditions: ${condition1.field}=${condition1.value}, ${condition2.field}=${condition2.value}`
            )
          )
          return
        }
        this.db.query(
          `DELETE FROM ${table} WHERE ${condition1.field}=$1 AND ${condition2.field}=$2`,
          [condition1.value, condition2.value] as
            | (string[] & Array<string | number>)
            | (number[] & Array<string | number>),
          (err) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            err ? reject(err) : resolve()
          }
        )
      }
    })
  }

  deleteLowerThan(
    table: T,
    field: string,
    value: string | number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db == null) {
        this.logger.error('[Pg][deleteLowerThan] DB not ready', {
          table,
          field
        })
        reject(new Error('Database not ready'))
      } else {
        if (
          !field ||
          field.length === 0 ||
          !value ||
          value.toString().length === 0
        ) {
          this.logger.error('[Pg][deleteLowerThan] Invalid parameters', {
            table,
            field,
            value
          })
          reject(
            new Error(
              `Bad deleteLowerThan call, field: ${field}, value: ${value}`
            )
          )
          return
        }
        const query = `DELETE FROM ${table} WHERE ${field}<$1`
        this.logger.debug('[Pg][deleteLowerThan] Executing', {
          table,
          field,
          query
        })
        this.db.query(
          query,
          [value] as
            | (string[] & Array<string | number>)
            | (number[] & Array<string | number>),
          (err) => {
            if (err) {
              this.logger.error('[Pg][deleteLowerThan] Failed', {
                table,
                field,
                query,
                error: err
              })
              reject(err)
            } else {
              this.logger.debug('[Pg][deleteLowerThan] Successful', {
                table,
                field
              })
              resolve()
            }
          }
        )
      }
    })
  }

  deleteWhere(
    table: T,
    conditions: ISQLCondition | ISQLCondition[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db == null) {
        this.logger.error('[Pg][deleteWhere] DB not ready', { table })
        reject(new Error('Database not ready'))
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
          let i = 0
          condition = filters
            .map((filt, index) => {
              i++
              return `${filt}${operators[index] ?? '='}$${i}`
            })
            .join(' AND ')
        }

        const query = `DELETE FROM ${table} WHERE ${condition}`
        this.logger.debug('[Pg][deleteWhere] Executing', {
          table,
          conditions: filters,
          operators,
          query
        })
        this.db.query(
          query,
          values as
            | (string[] & Array<string | number>)
            | (number[] & Array<string | number>),
          (err) => {
            if (err) {
              this.logger.error('[Pg][deleteWhere] Failed', {
                table,
                conditions: filters,
                operators,
                values,
                query,
                error: err
              })
              reject(err)
            } else {
              this.logger.debug('[Pg][deleteWhere] Successful', {
                table
              })
              resolve()
            }
          }
        )
      }
    })
  }

  close(): void {
    void this.db?.end()
  }
}

export default Pg
