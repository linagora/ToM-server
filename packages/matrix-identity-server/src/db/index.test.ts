/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { randomString } from '@twake/crypto'
import { getLogger, type TwakeLogger } from '@twake/logger'
import DefaultConfig from '../config.json'
import { type Config, type DbGetResult } from '../types'
import IdDb from './index'
import fs from 'fs'
import { assert } from 'console'

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
    // if (fs.existsSync('./testdb.db')) {
    //   fs.unlinkSync('./testdb.db')
    // }
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
                clearTimeout(idDb.cleanJob)
                idDb.close()
                done()
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
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
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
                    done()
                  })
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should provide verification-token', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .createInvitationToken('randomMailorPhone', { a: 1 })
          .then((token) => {
            expect(token).toMatch(/^[a-zA-Z0-9]+$/)
            idDb
              .verifyInvitationToken(token)
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
                  .catch(done)
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
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
                  .catch(done)
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
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
                clearTimeout(idDb.cleanJob)
                idDb.close()
                done()
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should update records matching both conditions', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .insert('roomTags', { id: 1, roomId: 1, authorId: 1, content: '' })
          .then(() => {
            idDb
              .updateAnd(
                'roomTags',
                { id: 2 },
                { field: 'id', value: 1 },
                { field: 'roomId', value: 1 }
              )
              .then((rows) => {
                expect(rows[0].id).toEqual('2')
                clearTimeout(idDb.cleanJob)
                idDb.close()
                done()
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should return entry on updateAnd', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .insert('roomTags', { id: 3, roomId: 1, authorId: 1, content: '' })
          .then(() => {
            idDb
              .updateAnd(
                'roomTags',
                { id: 4 },
                { field: 'id', value: 3 },
                { field: 'roomId', value: 1 }
              )
              .then((rows) => {
                expect(rows.length).toBe(1)
                expect(rows[0].id).toEqual('4')
                clearTimeout(idDb.cleanJob)
                idDb.close()
                done()
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should not update records if conditions do not match', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .insert('roomTags', { id: 4, roomId: 1, authorId: 1, content: '' })
          .then(() => {
            idDb
              .updateAnd(
                'roomTags',
                { authorId: 2 },
                { field: 'id', value: 4 },
                { field: 'roomId', value: 100 }
              )
              .then(() => {
                idDb
                  .get('roomTags', ['*'], { id: 4 })
                  .then((rows) => {
                    expect(rows[0].authorId).toEqual('1')
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
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
            clearTimeout(idDb.cleanJob)
            idDb.close()
            done()
          })
          .catch(done)
      })
      .catch(done)
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
                  .catch(done)
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
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
                      .catch(done)
                  })
                  .catch(done)
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
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
                  .catch(done)
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
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
                  .catch(done)
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should delete records matching both conditions', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        const idsNumber = 8
        const ids: string[] = []
        const insertsPromises: Array<Promise<DbGetResult>> = []
        for (let index = 0; index < idsNumber; index++) {
          ids[index] = randomString(64)
          insertsPromises[index] = idDb.insert('attempts', {
            email: `email${index}`,
            expires: index,
            attempt: index
          })
        }

        Promise.all(insertsPromises)
          .then(() => {
            idDb
              .deleteEqualAnd(
                'attempts',
                { field: 'email', value: 'email0' },
                { field: 'expires', value: '0' }
              )
              .then(() => {
                idDb
                  .getAll('attempts', ['email', 'expires', 'attempt'])
                  .then((rows) => {
                    expect(rows.length).toBe(idsNumber - 1)
                    rows.forEach((row) => {
                      expect(row.email).not.toEqual('email0')
                      expect(row.attempt).not.toEqual('0')
                      expect(row.expires).not.toEqual('0')
                    })
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
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

  it('should not delete records if conditions do not match', (done) => {
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
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
          .then(() => {
            idDb
              .deleteEqualAnd(
                'privateNotes',
                { field: 'content', value: '{0}' },
                { field: 'authorId', value: 'authorC' }
              )
              .then(() => {
                idDb
                  .getAll('privateNotes', [
                    'id',
                    'authorId',
                    'content',
                    'targetId'
                  ])
                  .then((rows) => {
                    expect(rows.length).toBe(idsNumber)
                    clearTimeout(idDb.cleanJob)
                    idDb.close()
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

  describe('testing sql requests', () => {
    it('should create aliases if the fields contain periods', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .get('accessTokens', ['accessTokens.id'], { id: '1' })
                .then((rows) => {
                  expect(rows.length).toBe(1)
                  expect(rows[0].accessTokens_id).toEqual('1')
                  clearTimeout(idDb.cleanJob)
                  idDb.close()
                  done()
                })
                .catch(done)
            })
            .catch(done)
        })
        .catch(done)
    })

    it('should get entry with corresponding higher than condition', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .insert('accessTokens', { id: '2', data: '{}' })
                .then(() => {
                  idDb
                    .insert('accessTokens', { id: '3', data: '{}' })
                    .then(() => {
                      idDb
                        .getHigherThan('accessTokens', ['id'], {
                          id: '1'
                        })
                        .then((rows) => {
                          expect(rows.length).toBe(2)
                          expect(rows[0].id).toEqual('2')
                          expect(rows[1].id).toEqual('3')
                          clearTimeout(idDb.cleanJob)
                          idDb.close()
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
        .catch(done)
    })

    it('should get entry with corresponding multiple conditions', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .insert('accessTokens', { id: '2', data: '{}' })
                .then(() => {
                  idDb
                    .insert('accessTokens', { id: '3', data: '{}' })
                    .then(() => {
                      idDb
                        .get('accessTokens', ['id'], {
                          id: ['1', '2']
                        })
                        .then((rows) => {
                          expect(rows.length).toBe(2)
                          expect(rows[0].id).toEqual('1')
                          expect(rows[1].id).toEqual('2')
                          clearTimeout(idDb.cleanJob)
                          idDb.close()
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
        .catch(done)
    })

    it('should sort entry by order', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '2', data: '{}' })
            .then(() => {
              idDb
                .insert('accessTokens', { id: '1', data: '{}' })
                .then(() => {
                  idDb
                    .get('accessTokens', ['id'], { data: '{}' }, 'id DESC')
                    .then((rows) => {
                      expect(rows.length).toBe(2)
                      expect(rows[0].id).toEqual('2')
                      expect(rows[1].id).toEqual('1')
                      clearTimeout(idDb.cleanJob)
                      idDb.close()
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

    it('should get entry with corresponding join conditions', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .insert('oneTimeTokens', { id: '1', expires: 0 })
                .then(() => {
                  idDb
                    .insert('accessTokens', { id: '2', data: '{}' })
                    .then(() => {
                      idDb
                        .insert('oneTimeTokens', { id: '2', expires: 1 })
                        .then(() => {
                          idDb
                            .getJoin(
                              ['accessTokens', 'oneTimeTokens'],
                              ['accessTokens.id', 'oneTimeTokens.expires'],
                              {
                                'accessTokens.data': '{}',
                                'oneTimeTokens.expires': 0
                              },
                              { 'accessTokens.id': 'oneTimeTokens.id' }
                            )
                            .then((rows) => {
                              expect(rows.length).toBe(1)
                              expect(rows[0].accessTokens_id).toEqual('1')
                              expect(rows[0].oneTimeTokens_expires).toEqual(0)
                              clearTimeout(idDb.cleanJob)
                              idDb.close()
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
            .catch(done)
        })
        .catch(done)
    })

    it('should get entry with corresponding equal or different conditions', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          const id = randomString(64)
          idDb
            .insert('accessTokens', { id, data: '{}' })
            .then(() => {
              idDb
                .insert('accessTokens', {
                  id: 'wrong_id_1',
                  data: '{wrong_data}'
                })
                .then(() => {
                  idDb
                    .insert('accessTokens', {
                      id: 'wrong_id_2',
                      data: '{}'
                    })
                    .then(() => {
                      idDb
                        .getWhereEqualOrDifferent(
                          'accessTokens',
                          ['id', 'data'],
                          { id },
                          { data: '{}' }
                        )
                        .then((rows) => {
                          expect(rows.length).toBe(2)
                          expect(rows[0].id).toEqual(id)
                          expect(rows[1].data).toEqual('{wrong_data}')
                          clearTimeout(idDb.cleanJob)
                          idDb.close()
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
        .catch(done)
    })

    it('should get entry with corresponding equal and higher conditions', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .insert('accessTokens', {
                  id: '2',
                  data: '{}'
                })
                .then(() => {
                  idDb
                    .insert('accessTokens', {
                      id: '3',
                      data: '{wrong_data}'
                    })
                    .then(() => {
                      idDb
                        .getWhereEqualAndHigher(
                          'accessTokens',
                          ['id', 'data'],
                          { data: '{}' },
                          { id: '1' }
                        )
                        .then((rows) => {
                          expect(rows.length).toBe(1)
                          expect(rows[0].id).toEqual('2')
                          expect(rows[0].data).toEqual('{}')
                          clearTimeout(idDb.cleanJob)
                          idDb.close()
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
        .catch(done)
    })

    it('should not return a null row if the conditions are not matched', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .getMaxWhereEqual('accessTokens', 'id', ['id', 'data'], {
                  id: '2'
                })
                .then((rows) => {
                  expect(rows.length).toBe(0)
                  clearTimeout(idDb.cleanJob)
                  idDb.close()
                  done()
                })
                .catch(done)
            })
            .catch(done)
        })
        .catch(done)
    })

    it('should get max entry with corresponding equal condition', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .insert('accessTokens', { id: '2', data: '{}' })
                .then(() => {
                  idDb
                    .insert('accessTokens', { id: '3', data: '{wrong_data}' })
                    .then(() => {
                      idDb
                        .getMaxWhereEqual(
                          'accessTokens',
                          'id',
                          ['id', 'data'],
                          {
                            data: '{}'
                          }
                        )
                        .then((rows) => {
                          expect(rows.length).toBe(1)
                          expect(rows[0].id).toEqual('2')
                          clearTimeout(idDb.cleanJob)
                          idDb.close()
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
        .catch(done)
    })

    it('should get max entry with corresponding lower condition and select all fields if not specified', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .insert('accessTokens', { id: '2', data: '{}' })
                .then(() => {
                  idDb
                    .insert('accessTokens', { id: '3', data: '{wrong_data}' })
                    .then(() => {
                      idDb
                        .getMaxWhereEqual('accessTokens', 'id', [], {
                          data: '{}'
                        })
                        .then((rows) => {
                          expect(rows.length).toBe(1)
                          expect(rows[0]).toHaveProperty('id')
                          expect(rows[0]).toHaveProperty('data')
                          expect(rows[0].id).toEqual('2')
                          expect(rows[0].data).toEqual('{}')
                          clearTimeout(idDb.cleanJob)
                          idDb.close()
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
        .catch(done)
    })

    it('should get max entry with multiple corresponding equal conditions', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .insert('accessTokens', { id: '2', data: '{...}' })
                .then(() => {
                  idDb
                    .insert('accessTokens', { id: '3', data: '{wrong_data}' })
                    .then(() => {
                      idDb
                        .getMaxWhereEqual(
                          'accessTokens',
                          'id',
                          ['id', 'data'],
                          {
                            data: ['{}', '{...}']
                          }
                        )
                        .then((rows) => {
                          expect(rows.length).toBe(1)
                          expect(rows[0].id).toEqual('2')
                          clearTimeout(idDb.cleanJob)
                          idDb.close()
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
        .catch(done)
    })

    it('should get max entry with corresponding equal and lower conditions', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .insert('accessTokens', { id: '2', data: '{}' })
                .then(() => {
                  idDb
                    .insert('accessTokens', { id: '3', data: '{wrong_data}' })
                    .then(() => {
                      idDb
                        .getMaxWhereEqualAndLower(
                          'accessTokens',
                          'id',
                          ['id', 'data'],
                          {
                            data: '{}'
                          },
                          { id: '4' }
                        )
                        .then((rows) => {
                          expect(rows.length).toBe(1)
                          expect(rows[0].id).toEqual('2')
                          expect(rows[0].data).toEqual('{}')
                          clearTimeout(idDb.cleanJob)
                          idDb.close()
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
        .catch(done)
    })

    it('should get min entry with corresponding equal and higher conditions', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{wrong_data}' })
            .then(() => {
              idDb
                .insert('accessTokens', { id: '2', data: '{}' })
                .then(() => {
                  idDb
                    .insert('accessTokens', { id: '3', data: '{}' })
                    .then(() => {
                      idDb
                        .getMinWhereEqualAndHigher(
                          'accessTokens',
                          'id',
                          ['id', 'data'],
                          {
                            data: '{}'
                          },
                          { id: '0' }
                        )
                        .then((rows) => {
                          expect(rows.length).toBe(1)
                          expect(rows[0].id).toEqual('2')
                          expect(rows[0].data).toEqual('{}')
                          clearTimeout(idDb.cleanJob)
                          idDb.close()
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
        .catch(done)
    })

    it('should get max entry with corresponding equal and lower conditions on multiple joined tables', (done) => {
      idDb = new IdDb(baseConf, logger)
      idDb.ready
        .then(() => {
          idDb
            .insert('accessTokens', { id: '1', data: '{}' })
            .then(() => {
              idDb
                .insert('oneTimeTokens', { id: '1', expires: 999 })
                .then(() => {
                  idDb
                    .insert('accessTokens', { id: '2', data: '{}' })
                    .then(() => {
                      idDb
                        .insert('oneTimeTokens', { id: '2', expires: 999 })
                        .then(() => {
                          idDb
                            .insert('accessTokens', {
                              id: '3',
                              data: '{wrong_data}'
                            })
                            .then(() => {
                              idDb
                                .insert('oneTimeTokens', {
                                  id: '3',
                                  expires: 999
                                })
                                .then(() => {
                                  idDb
                                    .insert('accessTokens', {
                                      id: '4',
                                      data: '{wrong_data}'
                                    })
                                    .then(() => {
                                      idDb
                                        .insert('oneTimeTokens', {
                                          id: '4',
                                          expires: 1001
                                        })
                                        .then(() => {
                                          idDb
                                            .getMaxWhereEqualAndLowerJoin(
                                              ['accessTokens', 'oneTimeTokens'],
                                              'accessTokens.id',
                                              [
                                                'accessTokens.id',
                                                'accessTokens.data',
                                                'oneTimeTokens.expires'
                                              ],
                                              {
                                                'accessTokens.data': '{}'
                                              },
                                              { 'oneTimeTokens.expires': 1000 },
                                              {
                                                'accessTokens.id':
                                                  'oneTimeTokens.id'
                                              }
                                            )
                                            .then((rows) => {
                                              expect(rows.length).toBe(1)
                                              expect(
                                                rows[0].accessTokens_id
                                              ).toEqual('2')
                                              expect(
                                                rows[0].accessTokens_data
                                              ).toEqual('{}')
                                              expect(
                                                rows[0].oneTimeTokens_expires
                                              ).toBeLessThan(1000)
                                              clearTimeout(idDb.cleanJob)
                                              idDb.close()
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
                            .catch(done)
                        })
                        .catch(done)
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

  it('should provide ephemeral Keypair', (done) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .createKeypair('shortTerm', 'curve25519')
          .then((_key) => {
            expect(_key.keyId).toMatch(/^(ed25519|curve25519):[A-Za-z0-9_-]+$/)
            clearTimeout(idDb.cleanJob)
            idDb.close()
            done()
          })
          .catch((e) => {
            done(e)
          })
      })
      .catch(done)
  })

  it('should return entry when creating new keyPair ', (done) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .createKeypair('shortTerm', 'curve25519')
          .then((_key) => {
            idDb
              .get('shortTermKeypairs', ['keyID'], {})
              .then((rows) => {
                expect(rows.length).toBe(1)
                expect(rows[0].keyID).toEqual(_key.keyId)
                clearTimeout(idDb.cleanJob)
                idDb.close()
                done()
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should delete a key from the shortKey pairs table', (done) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    idDb = new IdDb(baseConf, logger)
    idDb.ready
      .then(() => {
        idDb
          .createKeypair('shortTerm', 'ed25519')
          .then((key1) => {
            idDb
              .createKeypair('shortTerm', 'curve25519')
              .then((key2) => {
                idDb
                  .deleteKey(key1.keyId)
                  .then(() => {
                    idDb
                      .get('shortTermKeypairs', ['keyID'], {})
                      .then((rows) => {
                        expect(rows.length).toBe(1)
                        expect(rows[0].keyID).toEqual(key2.keyId)
                        clearTimeout(idDb.cleanJob)
                        idDb.close()
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
      .catch(done)
  })

  it('should list invitation tokens', async () => {
    const idDb = new IdDb(baseConf, logger)

    await idDb.ready

    await idDb.createInvitationToken('test@example.com', { test: 'a' })
    await idDb.createInvitationToken('+21652111333', { test: 'b' })
    await idDb.createInvitationToken('test@example.com', { test: 'c' })

    const tokens = await idDb.listInvitationTokens('test@example.com')
    assert(tokens)

    expect(tokens?.length).toBe(2)
  })

  it('should return an empty array of no invitation tokens were found', async () => {
    const idDb = new IdDb(baseConf, logger)

    await idDb.ready

    await idDb.createInvitationToken('test@example.com', { test: 'a' })

    const tokens = await idDb.listInvitationTokens('+21652111222')

    assert(tokens)

    expect(tokens?.length).toBe(0)
  })
})
