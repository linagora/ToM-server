import type { Database } from 'sqlite3'
import { type Config } from '..'

declare interface dbArgs {
  type: 'sqlite' | 'pg'
  host: string
  user?: string
  password?: string
}

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

// eslint-disable-next-line @typescript-eslint/promise-function-async
const IdentityServerDb = (args: dbArgs, conf: Config): Promise<Database> => {
  return new Promise((resolve, reject) => {
    if (args.type === 'sqlite') {
      import('sqlite3').then(mod => {
        const db = new mod.Database(args.host)
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
                    resolve(db)
                  } else if (i === arr.length) {
                    reject(new Error(`Was able to create ${created} database instead of ${arr.length}`))
                  }
                }
              })
            })
          } else {
            dbMaintenance(db, conf.database_vacuum_delay)
            /* istanbul ignore next */
            resolve(db)
          }
        })
      }).catch(e => {
        /* istanbul ignore next */
        reject(e)
      })
    } else {
      reject(new Error(`Unknown type ${args.type}`))
    }
  })
}

export default IdentityServerDb
