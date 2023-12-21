import { getLogger, type TwakeLogger } from '@twake/logger'
import fs from 'fs'
import defaultConfig from '../config.json'
import IdentityServerDB from '../db'
import { type Config } from '../types'
import UserDB from '../userdb'
import updateHashes from './changePepper'

const conf: Config = {
  ...defaultConfig,
  database_engine: 'sqlite',
  database_host: ':memory:',
  userdb_engine: 'sqlite',
  userdb_host: './src/__testData__/hashes.db',
  server_name: 'company.com'
}

const logger: TwakeLogger = getLogger()

describe('updateHashes', () => {
  let db: IdentityServerDB, userDB: UserDB

  beforeAll((done) => {
    db = new IdentityServerDB(conf, logger)
    userDB = new UserDB(conf, logger)
    Promise.all([userDB.ready, db.ready])
      .then(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore run is a sqlite3 method only
        userDB.db.db.run(
          'CREATE TABLE users (uid varchar(8), mobile varchar(12), mail varchar(32))',
          () => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
            // @ts-ignore same
            userDB.db.db.run(
              "INSERT INTO users VALUES('dwho', '33612345678', 'dwho@company.com')",
              () => {
                done()
              }
            )
          }
        )
      })
      .catch((e) => {
        done(e)
      })
  })

  afterAll(() => {
    clearTimeout(db.cleanJob)
    if (fs.existsSync('./src/__testData__/hashes.db')) {
      fs.unlinkSync('./src/__testData__/hashes.db')
    }
    db.close()
    userDB.close()
    logger.close()
  })

  it('should be able to generate new hashes without previous values', (done) => {
    updateHashes(conf, db, userDB, logger).catch((e) => {
      done(e)
    })
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore getAll isn't part of IdentityDB
      db.db
        .getAll('hashes', [])
        .then((rows) => {
          expect(rows.length).toBe(2)
          rows.forEach((row) => {
            expect(row.value).toBe('@dwho:company.com')
          })
          done()
        })
        .catch(done)
    }, 1000)
  })
})
