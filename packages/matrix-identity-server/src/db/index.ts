import type { Database } from 'sqlite3'

declare interface dbArgs {
  type: 'sqlite' | 'pg'
  host: string
  user?: string
  password?: string
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
const IdentityServerDb = (args: dbArgs): Promise<Database> => {
  return new Promise((resolve, reject) => {
    if (args.type === 'sqlite') {
      import('sqlite3').then(mod => {
        const db = new mod.Database(args.host)
        db.run('SELECT count(id) FROM tokens', (err: any) => {
          if (err != null && /no such table/.test(err.message)) {
            db.run('CREATE TABLE tokens(id varchar(64), data text)', (err: any) => {
              /* istanbul ignore next */
              if (err != null) {
                throw new Error(err)
              }
              resolve(db)
            })
          }
          else {
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
