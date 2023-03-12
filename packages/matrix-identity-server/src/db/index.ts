import type { Database, Statement as SQLiteStatement } from 'sqlite3'
import { type Config } from '..'

export type SupportedDatabases = 'sqlite' | 'pg'

// TODO: add pg type here
type Statement = SQLiteStatement

const tables = {
  tokens: 'id varchar(64) primary key, data text',
  oneTimeToken: 'id varchar(64) primary key, utime int, data text'
}

const dbMaintenance = (db: Database, delay: number): void => {
  const _vacuum = (): void => {
    /* istanbul ignore next */
    db.run('DELETE FROM oneTimeToken where utime > ' + Math.floor(Date.now() / 1000).toString())
    /* istanbul ignore next */
    setTimeout(_vacuum, delay)
  }
  setTimeout(_vacuum, delay)
}

class IdentityServerDb {
  db?: Database
  ready: Promise<boolean>
  constructor (conf: Config) {
    this.ready = new Promise((resolve, reject) => {
      /* istanbul ignore else */
      if (conf.database_engine === 'sqlite') {
        import('sqlite3').then(mod => {
          const db = this.db = new mod.Database(conf.database_host)
          /* istanbul ignore if */
          if (db == null) {
            throw new Error('Database not created')
          }
          db.run('SELECT count(id) FROM tokens', (err: any) => {
            if (err != null && /no such table/.test(err.message)) {
              let created = 0
              Object.keys(tables).forEach((table, i, arr) => {
                db.run(`CREATE TABLE ${table}(${tables[table as keyof typeof tables]})`, (err: any) => {
                  /* istanbul ignore next */
                  if (err != null) {
                    throw new Error(err)
                  } else {
                    created++
                    if (created === arr.length) {
                      dbMaintenance(db, conf.database_vacuum_delay)
                      resolve(true)
                    } else if (i === arr.length) {
                      reject(new Error(`Was able to create ${created} database instead of ${arr.length}`))
                    }
                  }
                })
              })
            } else {
              /* istanbul ignore next */
              dbMaintenance(db, conf.database_vacuum_delay)
              /* istanbul ignore next */
              resolve(true)
            }
          })
        }).catch(e => {
          /* istanbul ignore next */
          throw new Error(e)
        })
      } else {
        throw new Error(`unsupported database "${conf.database_engine}"`)
      }
    })
  }

  prepare (query: string): Statement | null {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return this.db.prepare(query)
  }

  //run (query: string, callback: (err: string | null) => void): void {
  //  /* istanbul ignore else */
  //  if (this.db != null) {
  //    this.db.run(query, callback)
  //  } else {
  //    // eslint-disable-next-line n/no-callback-literal
  //    callback('Database not ready, please wait')
  //  }
  //}

  all (query: string, callback: (err: string | null | string, row?: Array<Record<string, string>>) => void): void {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    this.db.all(query, callback)
  }

  serialize (callback: () => void): void {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    this.db.serialize(callback)
  }
}

export default IdentityServerDb
