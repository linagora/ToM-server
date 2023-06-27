/* eslint-disable @typescript-eslint/promise-function-async */
/* istanbul ignore file */
import { type Collections, type IdDbBackend } from '..'
import { type DbGetResult, type Config } from '../../types'
import createTables from './_createTables'
import SQL from './sql'
import { type ClientConfig, type Client as PgClient } from 'pg'

export type PgDatabase = PgClient

class Pg extends SQL implements IdDbBackend {
  declare db?: PgDatabase
  createDatabases(
    conf: Config,
    tables: Record<Collections, string>,
    indexes: Partial<Record<Collections, string[]>>,
    initializeValues: Partial<
      Record<Collections, Array<Record<string, string | number>>>
    >
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
            database: conf.database_name
          }
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (conf.database_host.match(/^(.*):(\d+)/)) {
            opts.host = RegExp.$1
            opts.port = parseInt(RegExp.$2)
          }
          const db: PgClient = (this.db = new pg.Client(opts))
          db.connect()
            .then(() => {
              createTables(
                this,
                tables,
                indexes,
                initializeValues,
                resolve,
                reject
              )
            })
            .catch((e) => {
              console.error('Unable to create tables', e)
              reject(e)
            })
        })
        .catch((e) => {
          console.error('Unable to load pg module', e)
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
      this.db.query(
        `INSERT INTO ${table}(${names.join(',')}) VALUES(${names
          .map((v, i) => `$${i + 1}`)
          .join(',')})`,
        vals,
        (err) => {
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          err ? reject(err) : resolve()
        }
      )
    })
  }

  update(
    table: Collections,
    values: Record<string, string | number>,
    field: string,
    value: string | number
  ): Promise<void> {
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
            .join(',')} WHERE ${field}=$${vals.length}`,
          vals,
          (err) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            err ? reject(err) : resolve()
          }
        )
      }
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
      if (this.db == null) {
        reject(new Error('Wait for database to be ready'))
      } else {
        let condition: string = ''
        if (fields == null || fields.length === 0) {
          fields = ['*']
        }
        if (field != null && value != null) {
          if (typeof value === 'object') {
            if (value.length > 0)
              condition =
                'WHERE ' +
                value.map((val, i) => `${field}${op}$${i + 1}`).join(' OR ')
          } else {
            value = value != null ? [value] : []
            if (value.length > 0) condition = 'WHERE ' + `${field}${op}$1`
          }
        }

        if (order != null) condition += ` ORDER BY ${order}`

        this.db.query(
          `SELECT ${fields.join(',')} FROM ${table} ${condition}`,
          value as string[],
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
    field?: string,
    value?: string | number | Array<string | number>,
    order?: string
  ): Promise<DbGetResult> {
    return this._get('=', table, fields, field, value, order)
  }

  getHigherThan(
    table: string,
    fields?: string[],
    field?: string,
    value?: string | number | Array<string | number>,
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
    if (this.db == null) return Promise.reject(new Error('DB not ready'))
    return this.db.query(`DELETE FROM ${table} WHERE ${field}=$1`, [
      value
    ]) as unknown as Promise<void>
  }

  deleteLowerThan(
    table: string,
    field: string,
    value: string | number
  ): Promise<void> {
    if (this.db == null) return Promise.reject(new Error('DB not ready'))
    return this.db.query(`DELETE FROM ${table} WHERE ${field}<$1`, [
      value
    ]) as unknown as Promise<void>
  }

  deleteWhere(
    table: string,
    filters: string | string[],
    values: string | number | Array<string | number>
  ): Promise<void> {
    if (this.db == null) return Promise.reject(new Error('DB not ready'))
    if (typeof values !== 'object') {
      values = [values] // Transform values into a list
    }
    if (typeof filters !== 'object') {
      filters = [filters] // Transform filters into a list
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
    return this.db.query(
      `DELETE FROM ${table} WHERE ${condition}`,
      values
    ) as unknown as Promise<void>
  }

  close(): void {
    void this.db?.end()
  }
}

export default Pg
