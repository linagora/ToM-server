import { type TwakeLogger } from '@twake/logger'
import type Pg from './pg'
import type SQLite from './sqlite'

function createTables<T extends string>(
  db: SQLite<T> | Pg<T>,
  tables: Record<T, string>,
  indexes: Partial<Record<T, string[]>>,
  initializeValues: Partial<Record<T, Array<Record<string, string | number>>>>,
  logger: TwakeLogger,
  resolve: () => void,
  reject: (e: Error) => void
): void {
  const promises: Array<Promise<void>> = []
  ;(Object.keys(tables) as T[]).forEach((table: T) => {
    promises.push(
      new Promise<void>((_resolve, _reject) => {
        db.exists(table)
          .then((count) => {
            /* istanbul ignore else */ // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (!count) {
              db.rawQuery(
                `CREATE TABLE IF NOT EXISTS ${table}(${tables[table]})`
              )
                // eslint-disable-next-line @typescript-eslint/promise-function-async
                .then(() =>
                  Promise.all(
                    ((indexes[table] as string[]) != null
                      ? (indexes[table] as string[])
                      : []
                    ).map<
                      Promise<any>
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    >((index) =>
                      db
                        .rawQuery(
                          `CREATE INDEX IF NOT EXISTS i_${table}_${index} ON ${table} (${index})`
                        )
                        .catch((e) => {
                          /* istanbul ignore next */
                          logger.error(`Index ${index}`, e)
                        })
                    )
                  )
                )
                // eslint-disable-next-line @typescript-eslint/promise-function-async
                .then(() =>
                  Promise.all(
                    (initializeValues[table] != null
                      ? (initializeValues[table] as Array<
                          Record<string, string | number>
                        >)
                      : []
                    ).map<
                      Promise<any>
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    >((entry) => db.insert(table, entry))
                  )
                )
                .then(() => {
                  _resolve()
                })
                .catch((e) => {
                  /* istanbul ignore next */
                  _reject(e)
                })
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
    .catch((e) => {
      /* istanbul ignore next */
      logger.error('Unable to create tables', e)
      /* istanbul ignore next */
      reject(e)
    })
}

export default createTables
