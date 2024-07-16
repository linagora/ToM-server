import MatrixDBmodified from './index'
import { type TwakeLogger, getLogger } from '@twake/logger'
import { type Config, type DbGetResult } from '../types'
import DefaultConfig from '../__testData__/matrixDbTestConf.json'
import fs from 'fs'
import { randomString } from '@twake/crypto'
import { buildMatrixDb } from '../__testData__/buildUserDB'

jest.mock('node-fetch', () => jest.fn())

const logger: TwakeLogger = getLogger()

// @ts-expect-error TS doesn't understand that the config is valid
const baseConf: Config = {
  ...DefaultConfig,
  database_engine: 'sqlite',
  userdb_engine: 'sqlite',
  cron_service: false,
  matrix_database_engine: 'sqlite',
  matrix_database_host: './src/__testData__/matrixTestdb.db',
  sms_folder: './src/__testData__/sms'
}

describe('Matrix DB', () => {
  let matrixDb: MatrixDBmodified

  beforeAll((done) => {
    buildMatrixDb(baseConf)
      .then(() => {
        done()
      })
      .catch((e) => {
        logger.error('Error while building matrix db:', e)
        done(e)
      })
  })

  afterAll(() => {
    fs.unlinkSync('./src/__testData__/matrixTestdb.db')
    logger.close()
  })

  it('should have SQLite database initialized', (done) => {
    matrixDb = new MatrixDBmodified(baseConf, logger)
    matrixDb.ready
      .then(() => {
        const userId = randomString(64)
        matrixDb
          .insert('profiles', { user_id: userId })
          .then(() => {
            matrixDb
              .get('profiles', ['user_id', 'displayname'], { user_id: userId })
              .then((rows) => {
                expect(rows.length).toBe(1)
                expect(rows[0].user_id).toEqual(userId)
                expect(rows[0].displayname).toEqual(null)
                matrixDb.close()
                done()
              })
              .catch((e) => done(e))
          })
          .catch((e) => done(e))
      })
      .catch((e) => done(e))
  })

  it('should return entry on insert', (done) => {
    matrixDb = new MatrixDBmodified(baseConf, logger)
    matrixDb.ready
      .then(() => {
        const userId = randomString(64)
        matrixDb
          .insert('profiles', { user_id: userId })
          .then((rows) => {
            expect(rows.length).toBe(1)
            expect(rows[0].user_id).toEqual(userId)
            expect(rows[0].displayname).toEqual(null)
            matrixDb.close()
            done()
          })
          .catch((e) => done(e))
      })
      .catch((e) => done(e))
  })

  it('should update', (done) => {
    matrixDb = new MatrixDBmodified(baseConf, logger)
    matrixDb.ready
      .then(() => {
        const userId = randomString(64)
        matrixDb
          .insert('profiles', { user_id: userId, displayname: 'test' })
          .then(() => {
            matrixDb
              .updateWithConditions(
                'profiles',
                { displayname: 'testUpdated' },
                [{ field: 'user_id', value: userId }]
              )
              .then(() => {
                matrixDb
                  .get('profiles', ['user_id', 'displayname'], {
                    user_id: userId
                  })
                  .then((rows) => {
                    expect(rows[0].displayname).toEqual('testUpdated')
                    matrixDb.close()
                    done()
                  })
                  .catch((e) => done(e))
              })
              .catch((e) => done(e))
          })
          .catch((e) => done(e))
      })
      .catch((e) => done(e))
  })

  it('should return entry on update', (done) => {
    matrixDb = new MatrixDBmodified(baseConf, logger)
    matrixDb.ready
      .then(() => {
        const userId = randomString(64)
        matrixDb
          .insert('profiles', { user_id: userId, displayname: 'test' })
          .then(() => {
            matrixDb
              .updateWithConditions(
                'profiles',
                { displayname: 'testUpdated' },
                [{ field: 'user_id', value: userId }]
              )
              .then((rows) => {
                expect(rows.length).toBe(1)
                expect(rows[0].user_id).toEqual(userId)
                expect(rows[0].displayname).toEqual('testUpdated')
                matrixDb.close()
                done()
              })
              .catch((e) => done(e))
          })
          .catch((e) => done(e))
      })
      .catch((e) => done(e))
  })

  it('should delete records matching condition', (done) => {
    matrixDb = new MatrixDBmodified(baseConf, logger)
    matrixDb.ready
      .then(() => {
        const idsNumber = 8
        const insertsPromises: Array<Promise<DbGetResult>> = []
        for (let index = 0; index < idsNumber; index++) {
          insertsPromises[index] = matrixDb.insert('users', {
            name: `user${index}`,
            password_hash: `hash${index}`,
            creation_ts: Date.now(),
            admin: 0,
            is_guest: 0,
            deactivated: 0
          })
        }

        Promise.all(insertsPromises)
          .then(() => {
            matrixDb
              .deleteEqual('users', 'name', 'user0')
              .then(() => {
                matrixDb
                  .getAll('users', ['name', 'password_hash'])
                  .then((rows) => {
                    expect(rows.length).toBe(idsNumber - 1)
                    rows.forEach((row) => {
                      expect(row.name).not.toEqual('user0')
                      expect(row.password_hash).not.toEqual('hash0')
                    })
                    matrixDb.close()
                    done()
                  })
                  .catch(done)
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })
})
