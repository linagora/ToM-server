import { type Collections } from '..'
import type Pg from './pg'
import type SQLite from './sqlite'

const createTables = (
  db: SQLite | Pg,
  tables: Record<Collections, string>,
  indexes: Partial<Record<Collections, string[]>>,
  initializeValues: Partial<
    Record<Collections, Array<Record<string, string | number>>>
  >,
  resolve: () => void,
  reject: (e: Error) => void
): void => {
  const promises: Array<Promise<void>> = []
  Object.keys(tables).forEach((table) => {
    promises.push(
      new Promise<void>((_resolve, _reject) => {
        db.exists(table)
          .then((count) => {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (!count) {
              db.rawQuery(
                `CREATE TABLE ${table}(${tables[table as keyof typeof tables]})`
              )
                .then(() => {
                  if (initializeValues[table as Collections] != null) {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                    // @ts-ignore defined
                    initializeValues[table as Collections].forEach((entry) => {
                      db.insert(table, entry)
                        .then(() => {
                          _resolve()
                        })
                        .catch(_reject)
                    })
                  } else {
                    _resolve()
                  }
                  indexes[table as Collections]?.forEach((index) => {
                    db.rawQuery(
                      `CREATE INDEX i_${table}_${index} ON ${table} (${index})`
                    ).catch((e) => {
                      /* istanbul ignore next */
                      console.error(`Index ${index}`, e)
                    })
                  })
                })
                .catch(_reject)
            } else {
              _resolve()
            }
          })
          /* istanbul ignore next */
          .catch(_reject)
      })
    )
  })
  Promise.all(promises)
    .then(() => {
      resolve()
    })
    .catch(reject)
}

export default createTables
