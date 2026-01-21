import { type TwakeLogger } from '@twake-chat/logger'
import type Pg from './pg.ts'
import type SQLite from './sqlite.ts'

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
              db.rawQuery(`CREATE TABLE ${table}(${tables[table]})`)
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
                          `CREATE INDEX i_${table}_${index} ON ${table} (${index})`
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
                // istanbul ignore next
                .catch((e) => {
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
    // istanbul ignore next
    .catch((e) => {
      logger.error('Unable to create tables', e)
      reject(e)
    })
}

export default createTables
