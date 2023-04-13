/* istanbul ignore file */
import { type Collections, type IdDbBackend } from '..'
import { type Config } from '../..'
import createTables from './_createTables'
import SQL from './sql'
import { type ClientConfig, type Client as PgClient } from 'pg'

export type PgDatabase = PgClient

class Pg<T = Config> extends SQL<T> implements IdDbBackend {
  declare db?: PgDatabase
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(conf: Config): Promise<boolean> {
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
              createTables(this, resolve, reject)
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

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  rawQuery(query: string): Promise<any> {
    if (this.db == null) return Promise.reject(new Error('DB not ready'))
    return this.db.query(query)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
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

  // eslint-disable-next-line @typescript-eslint/promise-function-async
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
      } else {
        let condition: string = ''
        if (fields == null || fields.length === 0) {
          fields = ['*']
        }
        if (field != null && value != null) {
          if (typeof value === 'object') {
            condition =
              'WHERE ' +
              value.map((val, i) => `${field}=$${i + 1}`).join(' OR ')
          } else {
            value = [value as string]
            condition = 'WHERE ' + `${field}=$1`
          }
        }
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

  // eslint-disable-next-line @typescript-eslint/promise-function-async
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

  // eslint-disable-next-line @typescript-eslint/promise-function-async
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

  close(): void {
    void this.db?.end()
  }
}

export default Pg
