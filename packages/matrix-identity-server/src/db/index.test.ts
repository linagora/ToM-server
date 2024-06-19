import { randomString } from '@twake/crypto'
import { getLogger, type TwakeLogger } from '@twake/logger'
import fs from 'fs'
import DefaultConfig from '../config.json'
import { type Config, type DbGetResult } from '../types'
import IdDb from './index'

const baseConf: Config = {
  ...DefaultConfig,
  database_engine: 'sqlite',
  database_host: './testdb.db',
  userdb_engine: 'ldap'
}

if (process.env.TEST_PG === 'yes') {
  baseConf.database_engine = 'pg'
  baseConf.database_host = process.env.PG_HOST ?? 'localhost'
  baseConf.database_user = process.env.PG_USER ?? 'twake'
  baseConf.database_password = process.env.PG_PASSWORD ?? 'twake'
  baseConf.database_name = process.env.PG_DATABASE ?? 'test'
}

const logger: TwakeLogger = getLogger()

describe('Id Server DB', () => {
  let idDb: IdDb

  afterEach(() => {
    process.env.TEST_PG === 'yes' || fs.unlinkSync('./testdb.db')
  })

  afterAll(() => {
    logger.close()
  })

  it('should have SQLite database initialized', (done) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        const id = randomString(64)
        idDb
          .insert('accessTokens', { id, data: '{}' })
          .then(() => {
            idDb
              .get('accessTokens', ['id', 'data'], { id })
              .then((rows) => {
                expect(rows.length).toBe(1)
                expect(rows[0].id).toEqual(id)
                expect(rows[0].data).toEqual('{}')
                clearTimeout(idDb.cleanJob)
                idDb.close()
                done()
              })
              .catch((e) => done(e))
          })
          .catch((e) => done(e))
      })
      .catch((e) => done(e))
  })

  it('should provide one-time-token', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .createOneTimeToken({ a: 1 })
          .then((token) => {
            expect(token).toMatch(/^[a-zA-Z0-9]+$/)
            idDb
              .verifyOneTimeToken(token)
              .then((data) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                // @ts-ignore
                expect(data.a).toEqual(1)
                idDb
                  .verifyOneTimeToken(token)
                  .then((data) => {
                    done("Souldn't have find a value")
                  })
                  .catch((e) => {
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
                    done()
                  })
              })
              .catch((e) => done(e))
          })
          .catch((e) => done(e))
      })
      .catch((e) => done(e))
  })

  it('should provide match()', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .createOneTimeToken({ a: 1 })
          .then((token) => {
            expect(token).toMatch(/^[a-zA-Z0-9]+$/)
            idDb
              .match('oneTimeTokens', ['id'], ['id'], token.substring(2, 28))
              .then((data) => {
                expect(data[0].id).toBe(token)
                idDb
                  .verifyOneTimeToken(token)
                  .then((data) => {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                    // @ts-ignore
                    expect(data.a).toEqual(1)
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
                    done()
                  })
                  .catch((e) => done(e))
              })
              .catch((e) => {
                done(e)
              })
          })
          .catch((e) => done(e))
      })
      .catch((e) => done(e))
  })

  it('should update', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .createOneTimeToken({ a: 1 })
          .then((token) => {
            idDb
              .update('oneTimeTokens', { data: '{ "a": 2 }' }, 'id', token)
              .then(() => {
                idDb
                  .verifyToken(token)
                  .then((data) => {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                    // @ts-ignore
                    expect(data.a).toEqual(2)
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
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
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .createOneTimeToken({ a: 1 })
          .then((token) => {
            idDb
              .update('oneTimeTokens', { data: '{"a": 2}' }, 'id', token)
              .then((rows) => {
                expect(rows.length).toBe(1)
                expect(rows[0].data).toEqual('{"a": 2}') // [OMH] Same as the test from get but directly from update.
                clearTimeout(idDb.cleanJob)
                done()
              })
              .catch((e) => done(e))
          })
          .catch((e) => done(e))
      })
      .catch((e) => done(e))
  })

  it('should return entry on insert', (done) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        const id = randomString(64)
        idDb
          .insert('accessTokens', { id, data: '{}' })
          .then((rows) => {
            expect(rows.length).toBe(1)
            expect(rows[0].id).toEqual(id)
            expect(rows[0].data).toEqual('{}')
            clearTimeout(idDb.cleanJob)
            idDb.close()
            done()
          })
          .catch((e) => done(e))
      })
      .catch((e) => done(e))
  })

  it('should return count without value', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .getCount('oneTimeTokens', 'id')
          .then((initialValue) => {
            idDb
              .createToken({ a: 1 })
              .then(() => {
                idDb
                  .getCount('oneTimeTokens', 'id')
                  .then((val) => {
                    expect(val).toBe(initialValue + 1)
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
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

  it('should return count with value', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .createToken({ a: 1 })
          .then((token) => {
            idDb
              .getCount('oneTimeTokens', 'id', token)
              .then((val) => {
                expect(val).toBe(1)
                idDb
                  .getCount('oneTimeTokens', 'id', token + 'z')
                  .then((val) => {
                    expect(val).toBe(0)
                    idDb
                      .getCount('oneTimeTokens', 'id', [token, token + 'z'])
                      .then((val) => {
                        expect(val).toBe(1)
                        clearTimeout(idDb.cleanJob)
                        idDb.close()
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
      .catch((e) => done(e))
  })

  it('should delete lower than value', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .createToken({ a: 1 }, 5)
          .then((token) => {
            idDb
              .deleteLowerThan('oneTimeTokens', 'expires', 6)
              .then((val) => {
                idDb
                  .getCount('oneTimeTokens', 'id', token + 'z')
                  .then((val) => {
                    expect(val).toBe(0)
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
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

  it('should delete lines with specified filters', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        const idsNumber = 8
        const ids: string[] = []
        const insertsPromises: Array<Promise<DbGetResult>> = []

        for (let index = 0; index < idsNumber; index++) {
          ids[index] = randomString(64)
          insertsPromises[index] = idDb.insert('accessTokens', {
            id: ids[index],
            data: `{${index % 2}}`
          })
        }

        Promise.all(insertsPromises)
          .then(() => {
            idDb
              .deleteWhere('accessTokens', {
                field: 'data',
                operator: '=',
                value: '{0}'
              })
              .then(() => {
                idDb
                  .getAll('accessTokens', ['id', 'data'])
                  .then((rows) => {
                    expect(rows.length).toBe(Math.floor(idsNumber / 2))
                    expect(rows[0].data).toEqual('{1}')
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
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

  it('should delete lines with specified filters', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        const idsNumber = 8
        const ids: string[] = []
        const insertsPromises: Array<Promise<DbGetResult>> = []

        for (let index = 0; index < idsNumber; index++) {
          ids[index] = randomString(64)
          insertsPromises[index] = idDb.insert('accessTokens', {
            id: ids[index],
            data: `{${index % 2}}`
          })
        }

        Promise.all(insertsPromises)
          .then(() => {
            idDb
              .deleteWhere('accessTokens', {
                field: 'data',
                operator: '=',
                value: '{0}'
              })
              .then(() => {
                idDb
                  .getAll('accessTokens', ['id', 'data'])
                  .then((rows) => {
                    expect(rows.length).toBe(Math.floor(idsNumber / 2))
                    expect(rows[0].data).toEqual('{1}')
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
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

  test('OneTimeToken timeout', (done) => {
    idDb = new IdDb({ ...baseConf, database_vacuum_delay: 3 }, logger)
    idDb.ready
      .then(() => {
        idDb
          .createOneTimeToken({ a: 1 }, 1)
          .then((token) => {
            setTimeout(() => {
              idDb
                .verifyOneTimeToken(token)
                .then((data) => {
                  done('Should throw')
                })
                .catch((e) => {
                  clearTimeout(idDb.cleanJob)
                  idDb.close()
                  done()
                })
            }, 6000)
          })
          .catch((e) => {
            done(e)
          })
      })
      .catch((e) => {
        done(e)
      })
  })
})
