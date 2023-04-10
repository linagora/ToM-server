import { type Collections } from '..'
import { type Config } from '../..'
import { type SQLiteDatabase } from './sqlite'

export const tables: Record<Collections, string> = {
  accessTokens: 'id varchar(64) primary key, data text',
  oneTimeTokens: 'id varchar(64) primary key, expires int, data text',
  attempts: 'email primary key, expires int, attempt int',
  keys: 'name varchar(32) primary key, data text',
  hashes: 'hash varchar(32) primary key, pepper varchar(32), type varchar(8), value text'
}

export const indexes: Partial<Record<Collections, string[]>> = {
  oneTimeTokens: ['expires'],
  attempts: ['expires']
}

abstract class SQL {
  db?: SQLiteDatabase // | pg,...
  ready: Promise<void>
  cleanJob?: NodeJS.Timeout

  constructor (conf: Config) {
    // @ts-expect-error method is defined in child class
    this.ready = this.createDatabases(conf)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  insert (table: string, values: Record<string, string | number>): Promise<void> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }
      const names: string[] = []
      const vals: Array<string | number> = []
      Object.keys(values).forEach(k => {
        names.push(k)
        vals.push(values[k])
      })
      const stmt = this.db.prepare(`INSERT INTO ${table}(${names.join(',')}) VALUES(${names.map(v => '?').join(',')})`)
      stmt.run(vals).finalize(() => {
        resolve()
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  update (table: Collections, values: Record<string, string | number>, field: string, value: string | number): Promise<void> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }
      const names: string[] = []
      const vals: Array<string | number> = []
      Object.keys(values).forEach(k => {
        names.push(k)
        vals.push(values[k])
      })
      vals.push(value)
      const stmt = this.db.prepare(`UPDATE ${table} SET ${names.join('=?,')}=? WHERE ${field}=?`)
      stmt.run(vals).finalize(() => {
        resolve()
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  get (table: string, fields: string[], field: string, value: string | number | string[]): Promise<Array<Record<string, string | number >>> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }
      let condition: string
      if (typeof value === 'object') {
        condition = value.map((val) => `${field}=?`).join(' OR ')
      } else {
        condition = `${field}=?`
      }
      const stmt = this.db.prepare(`SELECT ${fields.join(',')} FROM ${table} WHERE ${condition}`)
      stmt.all(value, (err: string, rows: Array<Record<string, string | number>>) => {
        /* istanbul ignore if */
        if (err != null) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getAll (table: string, fields: string[]): Promise<Array<Record<string, string | number >>> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }
      this.db.all(`SELECT ${fields.length > 0 ? fields.join(',') : '*'} FROM ${table}`, (err: string, rows: Array<Record<string, string | number>>) => {
        /* istanbul ignore if */
        if (err != null) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteEqual (table: string, field: string, value: string | number): Promise<void> {
    return new Promise((resolve, reject) => {
      /* istanbul ignore if */
      if (this.db == null) {
        throw new Error('Wait for database to be ready')
      }
      const stmt = this.db.prepare(`DELETE FROM ${table} WHERE ${field}=?`)
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

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteLowerThan (table: string, field: string, value: string | number): Promise<void> {
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
}

export default SQL
