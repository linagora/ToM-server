/* eslint-disable @typescript-eslint/promise-function-async */
/* istanbul ignore file */
import { type TwakeLogger } from '@twake/logger'
import { type ClientConfig, type Pool as PgPool } from 'pg'
import { type Collections, type ISQLCondition, type IdDbBackend } from '..'
import { type Config, type DbGetResult } from '../../types'
import createTables from './_createTables'
import SQL from './sql'

export type PgDatabase = PgPool

class Pg extends SQL implements IdDbBackend {
  declare db?: PgDatabase
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
            ssl: conf.database_ssl ? true : false
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
    })
  }

  rawQuery(query: string): Promise<any> {
    if (this.db == null) return Promise.reject(new Error('DB not ready'))
    return this.db.query(query)
  }

  exists(table: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.db != null) {
        this.db.query(
          `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename='${table.toLowerCase()}')`,
          (err, res) => {
            if (err == null) {
              resolve(res.rows[0].exists)
            } else {
              resolve(false)
            }
          }
        )
      } else {
        reject(new Error('DB not ready'))
      }
    })
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
      this.db.query(
        `INSERT INTO ${table}(${names.join(',')}) VALUES(${names
          .map((v, i) => `$${i + 1}`)
          .join(',')}) RETURNING *;`,
        vals,
        (err, rows) => {
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          err ? reject(err) : resolve(rows.rows)
        }
      )
    })
  }

  update(
    table: Collections,
    values: Record<string, string | number>,
    field: string,
    value: string | number
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      } else {
        const names: string[] = []
        const vals: Array<string | number> = []
        Object.keys(values).forEach((k) => {
          names.push(k)
          vals.push(values[k])
        })
        vals.push(value)
        this.db.query(
          `UPDATE ${table} SET ${names
            .map((name, i) => `${name}=$${i + 1}`)
            .join(',')} WHERE ${field}=$${vals.length} RETURNING *;`,
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

        this.db.query(
          `SELECT ${fields.join(',')} FROM ${table} ${condition}`,
          values,
          (err, rows) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            err ? reject(err) : resolve(rows.rows)
          }
        )
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
    table: string,
    fields?: string[],
    filterFields?: Record<string, string | number | Array<string | number>>,
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
        if (order != null) condition += ` ORDER BY ${order}`

        this.db.query(
          `SELECT ${fields.join(',')} FROM ${table} WHERE ${condition}`,
          values,
          (err, rows) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            err ? reject(err) : resolve(rows.rows)
          }
        )
      }
    })
  }

  deleteEqual(
    table: string,
    field: string,
    value: string | number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db == null) {
        reject(new Error('DB not ready'))
      } else {
        if (
          !field ||
          field.length === 0 ||
          !value ||
          value.toString().length === 0
        ) {
          reject(
            new Error(`Bad deleteEqual call, field: ${field}, value: ${value}`)
          )
          return
        }
        this.db.query(
          `DELETE FROM ${table} WHERE ${field}=$1`,
          [value],
          (err, rows) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            err ? reject(err) : resolve()
          }
        )
      }
    })
  }

  deleteLowerThan(
    table: string,
    field: string,
    value: string | number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db == null) {
        reject(new Error('Database not ready'))
      } else {
        if (
          !field ||
          field.length === 0 ||
          !value ||
          value.toString().length === 0
        ) {
          reject(
            new Error(
              `Bad deleteLowerThan call, field: ${field}, value: ${value}`
            )
          )
          return
        }
        this.db.query(
          `DELETE FROM ${table} WHERE ${field}<$1`,
          [value],
          (err) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            err ? reject(err) : resolve()
          }
        )
      }
    })
  }

  deleteWhere(
    table: string,
    conditions: ISQLCondition | ISQLCondition[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db == null) {
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

        this.db.query(
          `DELETE FROM ${table} WHERE ${condition}`,
          values,
          (err) => {
            if (err) {
              console.error(
                `Error with: DELETE FROM ${table} WHERE ${condition}`,
                values
              )
              console.error('Error', err)
            }
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            err ? reject(err) : resolve()
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
