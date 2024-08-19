/* eslint-disable @typescript-eslint/promise-function-async */
import MatrixDBmodified from './index'
import { type TwakeLogger, getLogger } from '@twake/logger'
import { type Config, type DbGetResult } from '../types'
import DefaultConfig from '../__testData__/registerConf.json'
import fs from 'fs'
import { randomString } from '@twake/crypto'
import { buildMatrixDb } from '../__testData__/buildUserDB'
import { parseQuerySqlite, parseWordsWithRegex } from '../matrixDb/sql/sqlite'

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

describe('Testing auxiliary functions', () => {
  describe('parseQuerySqlite', () => {
    it('should create a query string with prefix matching', () => {
      const result = parseQuerySqlite('test search')
      expect(result).toBe('(test* OR test) & (search* OR search)')
    })

    it('should handle mixed case and accented characters', () => {
      const result = parseQuerySqlite('TeSt Search')
      expect(result).toBe('(test* OR test) & (search* OR search)')
    })

    it('should return an empty string for an empty input', () => {
      const result = parseQuerySqlite('')
      expect(result).toBe('')
    })

    it('should ignore special characters and only use word-like characters', () => {
      const result = parseQuerySqlite('test@# search!')
      expect(result).toBe('(test* OR test) & (search* OR search)')
    })
  })

  describe('parseWordsWithRegex', () => {
    it('should return an array of words', () => {
      const result = parseWordsWithRegex('this is a test')
      expect(result).toEqual(['this', 'is', 'a', 'test'])
    })

    it('should return an empty array for a string with no word characters', () => {
      const result = parseWordsWithRegex('!!!')
      expect(result).toEqual([])
    })

    it('should handle mixed alphanumeric and special characters', () => {
      const result = parseWordsWithRegex('test-search123, more#words')
      expect(result).toEqual(['test-search123', 'more', 'words'])
    })

    it('should handle an empty string', () => {
      const result = parseWordsWithRegex('')
      expect(result).toEqual([])
    })
  })
})

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
  it('should insert a new record using upsert', (done) => {
    matrixDb = new MatrixDBmodified(baseConf, logger)
    matrixDb.ready
      .then(() => {
        const userId = randomString(64)
        const accountDataType = 'newDataType'
        const content = '{"key":"value"}'
        const streamId = Date.now()

        matrixDb
          .upsert(
            'account_data',
            {
              user_id: userId,
              account_data_type: accountDataType,
              stream_id: streamId,
              content,
              instance_name: 'instance1'
            },
            ['user_id', 'account_data_type']
          )
          .then((rows) => {
            expect(rows.length).toBe(1)
            expect(rows[0].user_id).toEqual(userId)
            expect(rows[0].account_data_type).toEqual(accountDataType)
            expect(rows[0].content).toEqual(content)
            expect(rows[0].stream_id).toEqual(streamId)
            expect(rows[0].instance_name).toEqual('instance1')
            matrixDb.close()
            done()
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should update an existing record using upsert', (done) => {
    matrixDb = new MatrixDBmodified(baseConf, logger)
    matrixDb.ready
      .then(() => {
        const userId = randomString(64)
        const accountDataType = 'existingDataType'
        const initialContent = '{"key":"initialValue"}'
        const updatedContent = '{"key":"updatedValue"}'
        const streamId = Date.now()

        matrixDb
          .insert('account_data', {
            user_id: userId,
            account_data_type: accountDataType,
            stream_id: streamId,
            content: initialContent,
            instance_name: 'instance1'
          })
          .then(() => {
            matrixDb
              .upsert(
                'account_data',
                {
                  user_id: userId,
                  account_data_type: accountDataType,
                  stream_id: streamId + 1,
                  content: updatedContent,
                  instance_name: 'instance2'
                },
                ['user_id', 'account_data_type']
              )
              .then((rows) => {
                expect(rows.length).toBe(1)
                expect(rows[0].user_id).toEqual(userId)
                expect(rows[0].account_data_type).toEqual(accountDataType)
                expect(rows[0].stream_id).toEqual(streamId + 1)
                expect(rows[0].content).toEqual(updatedContent)
                expect(rows[0].instance_name).toEqual('instance2')
                matrixDb.close()
                done()
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should update an existing record using upsert 2', (done) => {
    matrixDb = new MatrixDBmodified(baseConf, logger)
    matrixDb.ready
      .then(() => {
        const userId = randomString(64)
        const displayName = 'test'
        const avatarUrl = 'avatarUrl'
        const newDisplayName = 'testUpdated'

        matrixDb
          .insert('profiles', {
            user_id: userId,
            displayname: displayName,
            avatar_url: avatarUrl
          })
          .then(() => {
            matrixDb
              .upsert(
                'profiles',
                {
                  user_id: userId,
                  displayname: newDisplayName
                },
                ['user_id']
              )
              .then((rows) => {
                expect(rows.length).toBe(1)
                expect(rows[0].user_id).toEqual(userId)
                expect(rows[0].displayname).toEqual(newDisplayName)
                expect(rows[0].avatar_url).toEqual(avatarUrl)
                matrixDb.close()
                done()
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should insert a new record when no conflict exists', (done) => {
    matrixDb = new MatrixDBmodified(baseConf, logger)
    matrixDb.ready
      .then(() => {
        const userId = randomString(64)
        const accountDataType = 'nonConflictType'
        const content = '{"key":"value"}'
        const streamId = Date.now()

        matrixDb
          .upsert(
            'account_data',
            {
              user_id: userId,
              account_data_type: accountDataType,
              stream_id: streamId,
              content,
              instance_name: 'instance1'
            },
            ['user_id', 'account_data_type']
          )
          .then((rows) => {
            expect(rows.length).toBe(1)
            expect(rows[0].user_id).toEqual(userId)
            expect(rows[0].account_data_type).toEqual(accountDataType)
            expect(rows[0].content).toEqual(content)
            expect(rows[0].stream_id).toEqual(streamId)
            expect(rows[0].instance_name).toEqual('instance1')
            matrixDb.close()
            done()
          })
          .catch(done)
      })
      .catch(done)
  })
  describe('getMaxStreamId', () => {
    it('should return the maximum stream ID within the given range', (done) => {
      matrixDb = new MatrixDBmodified(baseConf, logger)
      matrixDb.ready
        .then(() => {
          const userId = 'user1'
          const deviceId = 'device1'

          const insertsPromises: Array<Promise<DbGetResult>> = []
          for (let streamId = 1; streamId <= 25; streamId++) {
            insertsPromises.push(
              matrixDb.insert('device_inbox', {
                user_id: userId,
                device_id: deviceId,
                stream_id: streamId,
                message_json: JSON.stringify({ content: `Message ${streamId}` })
              })
            )
          }

          return Promise.all(insertsPromises)
        })
        .then(() => {
          return matrixDb.getMaxStreamId('user1', 'device1', 10, 20, 10)
        })
        .then((maxStreamId) => {
          expect(maxStreamId).toBe(20)
          matrixDb.close()
        })
        .then(() => done())
        .catch(done)
    })

    it('should return an empty array if no stream IDs are found', (done) => {
      matrixDb = new MatrixDBmodified(baseConf, logger)
      matrixDb.ready
        .then(() => {
          const userId = 'user2'
          const deviceId = 'device2'

          return matrixDb.insert('device_inbox', {
            user_id: userId,
            device_id: deviceId,
            stream_id: 1,
            message_json: JSON.stringify({ content: 'Message 1' })
          })
        })
        .then(() => {
          return matrixDb.getMaxStreamId('user2', 'device2', 50, 100, 10)
        })
        .then((maxStreamId) => {
          expect(maxStreamId).toBe(null)
          matrixDb.close()
        })
        .then(() => done())
        .catch(done)
    })

    it('should handle cases where limit is 1', (done) => {
      matrixDb = new MatrixDBmodified(baseConf, logger)
      matrixDb.ready
        .then(() => {
          const userId = 'user3'
          const deviceId = 'device3'

          const insertsPromises: Array<Promise<DbGetResult>> = []
          for (let streamId = 1; streamId <= 15; streamId++) {
            insertsPromises.push(
              matrixDb.insert('device_inbox', {
                user_id: userId,
                device_id: deviceId,
                stream_id: streamId,
                message_json: JSON.stringify({ content: `Message ${streamId}` })
              })
            )
          }

          return Promise.all(insertsPromises)
        })
        .then(() => {
          return matrixDb.getMaxStreamId('user3', 'device3', 5, 15, 1)
        })
        .then((maxStreamId) => {
          expect(maxStreamId).toBe(6)
          matrixDb.close()
        })
        .then(() => done())
        .catch(done)
    })

    it('should handle cases with special characters in user_id or device_id', (done) => {
      matrixDb = new MatrixDBmodified(baseConf, logger)
      matrixDb.ready
        .then(() => {
          const userId = 'user@domain.com'
          const deviceId = 'device#1'

          const insertsPromises: Array<Promise<DbGetResult>> = []
          for (let streamId = 1; streamId <= 10; streamId++) {
            insertsPromises.push(
              matrixDb.insert('device_inbox', {
                user_id: userId,
                device_id: deviceId,
                stream_id: streamId,
                message_json: JSON.stringify({ content: `Message ${streamId}` })
              })
            )
          }

          return Promise.all(insertsPromises)
        })
        .then(() => {
          return matrixDb.getMaxStreamId(
            'user@domain.com',
            'device#1',
            1,
            10,
            10
          )
        })
        .then((maxStreamId) => {
          expect(maxStreamId).toBe(10)
          matrixDb.close()
        })
        .then(() => done())
        .catch(done)
    })
  })
})
