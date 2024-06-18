/* eslint-disable @typescript-eslint/strict-boolean-expressions */
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
    if (idDb) {
      clearTimeout(idDb.cleanJob)
      idDb.close()
    }
    if (process.env.TEST_PG !== 'yes') {
      fs.unlinkSync('./testdb.db')
    }
  })

  afterAll(() => {
    if (logger) {
      logger.close()
    }
  })

  it('should have SQLite database initialized', (done) => {
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
                    done("Shouldn't have found a value")
                  })
                  .catch((e) => {
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
                expect(rows[0].data).toEqual('{"a": 2}')
                done()
              })
              .catch((e) => done(e))
          })
          .catch((e) => done(e))
      })
      .catch((e) => done(e))
  })

  describe('updateAnd', () => {
    beforeEach((done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready.then(() => done()).catch((e) => done(e))
    })
    it('should update records matching both conditions', (done) => {
      const idsNumber = 8
      const ids: string[] = []
      const insertsPromises: Array<Promise<DbGetResult>> = []

      for (let index = 0; index < idsNumber; index++) {
        ids[index] = randomString(64)
        insertsPromises[index] = idDb.insert('privateNotes', {
          id: ids[index],
          authorId: `author${index}`,
          content: `{${index}}`,
          targetId: `target${index}`
        })
      }

      Promise.all(insertsPromises)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return idDb.updateAnd(
            'privateNotes',
            { content: 'updatedContent' },
            { field: 'authorId', value: 'author0' },
            { field: 'targetId', value: 'target0' }
          )
        })
        .then((rows) => {
          expect(rows.length).toBe(1)
          expect(rows[0].content).toEqual('updatedContent')
          done()
        })
        .catch((e) => done(e))
    })

    it('should return entry on update', (done) => {
      const idsNumber = 8
      const ids: string[] = []
      const insertsPromises: Array<Promise<DbGetResult>> = []

      for (let index = 0; index < idsNumber; index++) {
        ids[index] = randomString(64)
        insertsPromises[index] = idDb.insert('privateNotes', {
          id: ids[index],
          authorId: `author${index}`,
          content: `{${index}}`,
          targetId: `target${index}`
        })
      }

      Promise.all(insertsPromises)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return idDb.updateAnd(
            'privateNotes',
            { content: '{"a": 2}' },
            { field: 'authorId', value: 'author0' },
            { field: 'targetId', value: 'target0' }
          )
        })
        .then((rows) => {
          expect(rows.length).toBe(1)
          expect(rows[0].content).toEqual('{"a": 2}')
          done()
        })
        .catch((e) => done(e))
    })

    it('should not update records if conditions do not match', (done) => {
      const idsNumber = 8
      const ids: string[] = []
      const insertsPromises: Array<Promise<DbGetResult>> = []

      for (let index = 0; index < idsNumber; index++) {
        ids[index] = randomString(64)
        insertsPromises[index] = idDb.insert('privateNotes', {
          id: ids[index],
          authorId: `author${index}`,
          content: `{${index}}`,
          targetId: `target${index}`
        })
      }

      Promise.all(insertsPromises)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return idDb.updateAnd(
            'privateNotes',
            { content: 'updatedContent' },
            { field: 'authorId', value: 'authorNotExist' },
            { field: 'targetId', value: 'target0' }
          )
        })
        .then((rows) => {
          expect(rows.length).toBe(0)
          done()
        })
        .catch((e) => done(e))
    })
  })

  it('should return entry on insert', (done) => {
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

  describe('deleteEqualAnd', () => {
    beforeEach((done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready.then(() => done()).catch((e) => done(e))
    })

    it('should delete records matching both conditions', (done) => {
      const idsNumber = 8
      const ids: string[] = []
      const insertsPromises: Array<Promise<DbGetResult>> = []

      for (let index = 0; index < idsNumber; index++) {
        ids[index] = randomString(64)
        insertsPromises[index] = idDb.insert('privateNotes', {
          id: ids[index],
          authorId: `author${index}`,
          content: `{${index}}`,
          targetId: `target${index}`
        })
      }

      Promise.all(insertsPromises)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return idDb.deleteEqualAnd(
            'privateNotes',
            { field: 'content', value: '{0}' },
            { field: 'authorId', value: 'author0' }
          )
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return idDb.getAll('privateNotes', [
            'id',
            'authorId',
            'content',
            'targetId'
          ])
        })
        .then((rows) => {
          expect(rows.length).toBe(idsNumber - 1)
          rows.forEach((row) => {
            expect(row.content).not.toEqual('{0}')
            expect(row.authorId).not.toEqual('author0')
          })
          done()
        })
        .catch((e) => done(e))
    })

    it('should not delete records if conditions do not match', (done) => {
      const idsNumber = 8
      const ids: string[] = []
      const insertsPromises: Array<Promise<DbGetResult>> = []

      for (let index = 0; index < idsNumber; index++) {
        ids[index] = randomString(64)
        insertsPromises[index] = idDb.insert('privateNotes', {
          id: ids[index],
          authorId: `author${index % 2}`,
          content: `{${index % 2}}`,
          targetId: 'targetC'
        })
      }

      Promise.all(insertsPromises)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return idDb.deleteEqualAnd(
            'privateNotes',
            { field: 'content', value: '{0}' },
            { field: 'authorId', value: 'authorC' }
          )
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return idDb.getAll('privateNotes', [
            'id',
            'authorId',
            'content',
            'targetId'
          ])
        })
        .then((rows) => {
          expect(rows.length).toBe(idsNumber)
          done()
        })
        .catch((e) => done(e))
    })
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
