import fs from 'fs'
import fetch from 'node-fetch'
import { logger } from '../../jest.globals'
import defaultConfig from '../config.json'
import IdentityServerDB from '../db'
import { type Config } from '../types'
import UserDB from '../userdb'
import { errCodes } from '../utils/errors'
import updateFederationHashes from './update-federation-hashes'

jest.mock('node-fetch', () => {
  return {
    __esModule: true,
    default: jest.fn()
  }
})

const fetchMock = fetch as jest.Mock

const conf: Config = {
  ...defaultConfig,
  base_url: 'https://matrix.example.com',
  database_engine: 'sqlite',
  database_host: ':memory:',
  userdb_engine: 'sqlite',
  userdb_host: './src/__testData__/hashes.db',
  server_name: 'company.com',
  federation_server: 'federation.example.com'
}

let db: IdentityServerDB, userDB: UserDB

beforeAll((done) => {
  db = new IdentityServerDB(conf, logger)
  userDB = new UserDB(conf, undefined, logger)
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
  if (fs.existsSync('./src/__testData__/hashes.db')) {
    fs.unlinkSync('./src/__testData__/hashes.db')
  }
  clearTimeout(db.cleanJob)
  db.close()
})

describe('updateFederationHashes', () => {
  it('should be able to calculate and push hashes to federation server', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          algorithms: ['sha256'],
          lookup_pepper: 'matrixrocks'
        }),
        status: 200
      })
      .mockResolvedValueOnce({
        json: async () => ({}),
        status: 200
      })

    await updateFederationHashes(conf, userDB, logger)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('default method should throw if an error occured', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          algorithms: ['sha256'],
          lookup_pepper: 'matrixrocks'
        }),
        status: 200
      })
      .mockRejectedValueOnce({
        json: async () => ({
          errcode: errCodes.unAuthorized,
          error: 'Unauthorized'
        }),
        status: 401
      })

    await expect(
      // @ts-expect-error equivalent to MatrixIdentityServer here
      updateFederationHashes({ conf, db, userDB, logger })
    ).rejects.toThrowError('Failed to update federation server hashes')
  })
})
