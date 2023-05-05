import { type Config } from '../../types'
import { type tokenDetail } from '../middlewares/auth'
import sqlite3 from 'sqlite3'

const token: tokenDetail = {
  value: 'accessTokenddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  content: { sub: 'userId', epoch: 1 }
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
const buildTokenTable = (conf: Config): Promise<void> => {
  return new Promise((resolve, reject) => {
    const dbManager = new sqlite3.Database(conf.database_host)
    const matrixDbManager = new sqlite3.Database(conf.matrix_database_host)

    dbManager.run(
      'CREATE TABLE matrixTokens (id varchar(64) primary key, data text)',
      () =>
        dbManager.run(
          `INSERT INTO matrixTokens VALUES('${token.value}', '${JSON.stringify(
            token.content
          )}')`,
          () => {
            dbManager.run('CREATE TABLE users (uid varchar(8), mobile varchar(12), mail varchar(32))', () => {
              dbManager.close((err) => {
                /* istanbul ignore if */
                if(err != null) {
                  console.error(err)
                  reject(err)
                } else {
                  resolve()
                }
              })
            })
          }
        )
    )

    matrixDbManager.run('CREATE TABLE users (uid varchar(8), name varchar(32), mobile varchar(12), mail varchar(32))')
  })
}

export default buildTokenTable
