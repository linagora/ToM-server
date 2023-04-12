import { type Database } from 'sqlite3'
import { tables, indexes } from './sql'

const createTables = (db: Database, resolve: (b: boolean) => void, reject: (e: Error) => void): void => {
  db.run('SELECT count(id) FROM accessTokens', (err: any) => {
    if (err != null && /no such table/.test(err.message)) {
      let created = 0
      Object.keys(tables).forEach((table, i, arr) => {
        db.run(`CREATE TABLE ${table}(${tables[table as keyof typeof tables]})`, (err: Error | null) => {
        /* istanbul ignore if */
          if (err != null) {
            throw err
          } else {
            created++
            /* istanbul ignore else */
            if (created === arr.length) {
              resolve(true)
              Object.keys(indexes).forEach((table) => {
                // @ts-expect-error table is defined here
                indexes[table as Collections].forEach(index => {
                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  db.run(`CREATE INDEX i_${table}_${index} ON ${table} (${index})`, (err: Error | null) => {
                    /* istanbul ignore next */ // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    if (err != null) console.error(`Index ${index}`, err)
                  })
                })
              })
            } else if (i === arr.length) {
              reject(new Error(`Was able to create ${created} database(s) instead of ${arr.length}`))
            }
          }
        })
      })
    } else {
      /* istanbul ignore next */
      resolve(true)
    }
  })
}

export default createTables
