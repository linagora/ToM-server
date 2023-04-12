import { tables, indexes } from './sql'
import type SQLite from './sqlite'

const createTables = (db: SQLite, resolve: (b: boolean) => void, reject: (e: Error) => void): void => {
  db.exists('accessTokens').then(count => {
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (count) {
      resolve(true)
    } else {
      const promises: Array<Promise<void>> = []
      Object.keys(tables).forEach((table, i, arr) => {
        promises.push(db.rawQuery(`CREATE TABLE ${table}(${tables[table as keyof typeof tables]})`))
      })
      Promise.all(promises).then(arr => {
        resolve(true)
        Object.keys(indexes).forEach((table) => {
          // @ts-expect-error table is defined here
          indexes[table as Collections].forEach((index: string) => {
            db.rawQuery(`CREATE INDEX i_${table}_${index} ON ${table} (${index})`).catch(e => {
              /* istanbul ignore next */
              console.error(`Index ${index}`, e)
            })
          })
        })
      }).catch(e => {
        /* istanbul ignore next */
        reject(e)
      })
    }
  }).catch(err => {
    /* istanbul ignore next */
    reject(err)
  })
}

export default createTables
