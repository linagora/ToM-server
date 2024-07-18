import { getLogger, type TwakeLogger } from '@twake/logger'
import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import CronTasks from '.'
import defaultConfig from '../config.json'
import IdentityServerDB from '../db'
import { type Config } from '../types'
import UserDB from '../userdb'

jest.mock('node-fetch', () => jest.fn())

const dbPath = path.join(__dirname, 'check-quota-test.db')

const conf: Config = {
  ...defaultConfig,
  base_url: 'https://matrix.example.com',
  database_engine: 'sqlite',
  database_host: ':memory:',
  matrix_database_engine: 'sqlite',
  matrix_database_host: dbPath,
  userdb_engine: 'sqlite',
  userdb_host: ':memory:',
  server_name: 'company.com',
  federated_identity_services: ['federated-identity.example.com']
}

const logger: TwakeLogger = getLogger()

let db: IdentityServerDB, userDB: UserDB, cronTasks: CronTasks

describe('cron tasks', () => {
  beforeAll(async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        const testdb = new sqlite3.Database(dbPath, async (err) => {
          if (err !== null) {
            reject(new Error(`Failed to open database: ${err.message}`))
          }

          try {
            await new Promise((resolve, reject) => {
              testdb.run(
                'CREATE TABLE IF NOT EXISTS users (name varchar(64) PRIMARY KEY)',
                (e: unknown) => {
                  if (e !== null)
                    reject(
                      new Error(`Failed to create table users: ${e as string}`)
                    )
                  resolve(true)
                }
              )
            })

            resolve()
          } catch (error) {
            console.log({ error })
            reject(Error('Failed to initialize test database'))
          }
        })
      })
      db = new IdentityServerDB(conf, logger)
      userDB = new UserDB(conf, logger)
      await Promise.all([userDB.ready, db.ready])
      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore run is a sqlite3 method only
        userDB.db.db.run(
          'CREATE TABLE IF NOT EXISTS users (uid varchar(8), mobile varchar(12), mail varchar(32))',
          () => {
            resolve()
          }
        )
      })
    } catch (error) {
      console.log(error)
      throw error
    }
  })

  afterAll(() => {
    clearTimeout(db.cleanJob)
    db.close()
    userDB.close()
    cronTasks.stop()
    fs.existsSync(dbPath) && fs.unlinkSync(dbPath)
    logger.close()
  })

  it('should init all cron tasks', async () => {
    cronTasks = new CronTasks(conf, db, userDB, logger)
    await cronTasks.ready
    expect(cronTasks.tasks).toHaveLength(4)
  })
})
