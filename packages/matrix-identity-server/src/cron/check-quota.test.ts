/* eslint-disable @typescript-eslint/no-misused-promises */
import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { logger } from '../../jest.globals'
import defaultConfig from '../config.json'
import IdentityServerDb from '../db'
import type { Config, UserQuota } from '../types'
import checkQuota from './check-quota'

const dbPath = path.join(__dirname, 'check-quota.test.db')

const conf: Config = {
  ...defaultConfig,
  database_engine: 'sqlite',
  database_host: ':memory:',
  matrix_database_engine: 'sqlite',
  matrix_database_host: dbPath,
  userdb_engine: 'sqlite',
  userdb_host: ':memory:'
}

let db: IdentityServerDb

beforeAll(async () => {
  try {
    await new Promise<void>((resolve, reject) => {
      const testdb = new sqlite3.Database(dbPath, async (err) => {
        if (err !== null) {
          reject(new Error(`Failed to open database: ${err.message}`))
        }

        try {
          await new Promise((resolve, reject) => {
            testdb.run(
              'CREATE TABLE local_media_repository (user_id  varchar(64), media_length int)',
              (e: unknown) => {
                if (e !== null)
                  reject(
                    new Error(
                      `Failed to create table local_media_repository: ${
                        e as string
                      }`
                    )
                  )

                resolve(true)
              }
            )
          })

          await new Promise((resolve, reject) => {
            testdb.run(
              'INSERT INTO local_media_repository VALUES ("@user:matrix.org", 100)',
              (e: unknown) => {
                if (e !== null)
                  reject(
                    new Error(
                      `Failed to insert into table local_media_repository: ${
                        e as string
                      }`
                    )
                  )
                resolve(true)
              }
            )
          })

          await new Promise((resolve, reject) => {
            testdb.run(
              'INSERT INTO local_media_repository VALUES ("@user:matrix.org", 600)',
              (e: unknown) => {
                if (e !== null)
                  reject(
                    new Error(
                      `Failed to insert into table local_media_repository: ${
                        e as string
                      }`
                    )
                  )
                resolve(true)
              }
            )
          })
          await new Promise((resolve, reject) => {
            testdb.run(
              'CREATE TABLE users (name varchar(64) PRIMARY KEY)',
              (e: unknown) => {
                if (e !== null)
                  reject(
                    new Error(`Failed to create table users: ${e as string}`)
                  )
                resolve(true)
              }
            )
          })

          await new Promise((resolve, reject) => {
            testdb.run(
              'INSERT INTO users VALUES ("@user:matrix.org")',
              (e: unknown) => {
                if (e !== null)
                  reject(
                    new Error(
                      `Failed to insert into table users: ${e as string}`
                    )
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
    db = new IdentityServerDb(conf, logger)
    await db.ready
  } catch (error) {
    console.log(error)
    throw error
  }
})

afterAll(() => {
  clearTimeout(db.cleanJob)
  db.close()
  fs.existsSync(dbPath) && fs.unlinkSync(dbPath)
})

describe('the checkQuota cron job', () => {
  it('should collect the user usage and save the result', async () => {
    await checkQuota(conf, db)

    const result = (await db.get('userQuotas', ['size'], {
      user_id: '@user:matrix.org'
    })) as unknown as UserQuota[]

    expect(result[0].size).toBe(700)
  })
})
