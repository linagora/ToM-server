import fs from 'fs'
import VaultDb from '.'
import DefaultConfig from '../../config.json'
import { Database } from 'sqlite3'
import { type Config } from '../../utils'
import path from 'path'
import JEST_PROCESS_ROOT_PATH from '../../../jest.globals'

const testFilePath = path.join(JEST_PROCESS_ROOT_PATH, 'testdb.db')

const baseConf: Partial<Config> = {
  ...DefaultConfig,
  database_engine: 'sqlite',
  database_host: testFilePath,
  userdb_engine: 'sqlite'
}

const mockedFn = jest.fn()

describe('Vault Server DB', () => {
  const userId = 'test'
  const testSentence = 'This is a test sentence'

  afterEach(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
    jest.resetModules()
  })

  it('should have SQLite database initialized', (done) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    const vaultDb = new VaultDb(baseConf as Config)
    vaultDb.ready
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        return vaultDb.insert({ userId, words: testSentence })
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        return vaultDb.get('test')
      })
      .then((rows) => {
        expect(rows.length).toBe(1)
        expect(Object.keys(rows[0]).length).toEqual(1)
        expect(rows[0]).toHaveProperty('words', testSentence)
        done()
      })
      .catch((e) => done(e))
  })

  it('should have SQLite database initialized with default', (done) => {
    jest.mock('sqlite3', () => {
      const sqliteModule = jest.requireActual('sqlite3')
      return {
        __esModule: true,
        ...sqliteModule,
        Database: null,
        default: {
          Database: sqliteModule.Database
        }
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    const vaultDb = new VaultDb(baseConf as Config)
    vaultDb.ready
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        return vaultDb.insert({ userId, words: testSentence })
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        return vaultDb.get('test')
      })
      .then((rows) => {
        expect(rows.length).toBe(1)
        expect(Object.keys(rows[0]).length).toEqual(1)
        expect(rows[0]).toHaveProperty('words', testSentence)
        done()
      })
      .catch((e) => done(e))
  })

  it('should throw error on creating database error', (done) => {
    jest.mock('sqlite3', () => {
      const sqliteModule = jest.requireActual('sqlite3')
      return {
        __esModule: true,
        ...sqliteModule,
        Database: mockedFn.mockImplementation(() => {
          return {
            ...sqliteModule.Database,
            run: (sql: string, callback: (err: Error | null) => void) => {
              callback(new Error('SQLITE_ERROR: no such table: forced error'))
            }
          }
        })
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    const vaultDb = new VaultDb(baseConf as Config)
    vaultDb.ready.catch((e) => {
      expect(e.message).toEqual(
        'Did not succeed to create recoveryWords table in database'
      )
      jest.mock('sqlite3', () => {
        const sqliteModule = jest.requireActual('sqlite3')
        return {
          __esModule: true,
          ...sqliteModule
        }
      })
      done()
    })
  })

  it('should throw error on inserting element error', (done) => {
    const errorMessage = 'Error on inserting element'
    const vaultDb = new VaultDb(baseConf as Config)
    vaultDb.db.insert = jest.fn().mockRejectedValue(new Error(errorMessage))
    vaultDb.ready
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        return vaultDb.insert({ userId, words: testSentence })
      })
      .catch((e) => {
        expect(e.message).toEqual(errorMessage)
        done()
      })
  })

  it('should throw error on getting element error', (done) => {
    const errorMessage = 'Error on getting element'
    const vaultDb = new VaultDb(baseConf as Config)
    vaultDb.db.get = jest.fn().mockRejectedValue(new Error(errorMessage))
    vaultDb.ready
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        return vaultDb.get(userId)
      })
      .catch((e) => {
        expect(e.message).toEqual(errorMessage)
        done()
      })
  })

  it('should not create table if already exists', (done) => {
    let runSpy: jest.SpyInstance
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    const vaultDb = new VaultDb(baseConf as Config)
    vaultDb.ready
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        runSpy = jest.spyOn(Database.prototype, 'run')
        return new VaultDb(baseConf as Config).ready
      })
      .then(() => {
        expect(runSpy).toHaveBeenCalledTimes(1)
        done()
      })
      .catch((e) => done(e))
  })
})
