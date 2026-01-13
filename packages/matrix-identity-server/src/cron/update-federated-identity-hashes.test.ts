import { Hash } from '@twake-chat/crypto'
import { getLogger, type TwakeLogger } from '@twake-chat/logger'
import fs from 'fs'
import fetch from 'node-fetch'
import defaultConfig from '../config.json'
import { type Config } from '../types'
import UserDB from '../userdb'
import { errCodes } from '@twake-chat/utils'
import updateFederatedIdentityHashes from './update-federated-identity-hashes'

jest.mock('node-fetch', () => {
  return {
    __esModule: true,
    default: jest.fn()
  }
})

const logger: TwakeLogger = getLogger()

const fetchMock = fetch as jest.Mock

const conf: Config = {
  ...defaultConfig,
  base_url: 'https://matrix.example.com:8448',
  database_engine: 'sqlite',
  database_host: ':memory:',
  userdb_engine: 'sqlite',
  userdb_host: './src/__testData__/hashes.db',
  server_name: 'company.com',
  federated_identity_services: [
    'federated-identity1.example.com',
    'federated-identity2.example.com',
    'federated-identity3.example.com'
  ]
}

const defaultPepper = 'matrixrocks'
const altPeppers = ['altPepper1', 'altPepper2']

const getHashDetailsSuccess = {
  state: 'resolved',
  value: {
    json: async () => ({
      algorithms: ['sha256'],
      lookup_pepper: defaultPepper
    }),
    status: 200
  }
}

const getHashDetailsSuccessMultiplePeppers = {
  state: 'resolved',
  value: {
    json: async () => ({
      algorithms: ['sha256'],
      lookup_pepper: defaultPepper,
      alt_lookup_peppers: ['altPepper1', 'altPepper2']
    }),
    status: 200
  }
}

const getHashDetailsNoAlgorithm = {
  state: 'resolved',
  value: {
    json: async () => ({
      algorithms: null,
      lookup_pepper: defaultPepper
    }),
    status: 200
  }
}

const getHashDetailsNoPepper = {
  state: 'resolved',
  value: {
    json: async () => ({
      algorithms: ['sha256'],
      lookup_pepper: null
    }),
    status: 200
  }
}

const errorOnParsingResponseBody = {
  state: 'resolved',
  value: {
    json: async () =>
      await Promise.reject(new Error('Error on parsing response body')),
    status: 200
  }
}

const postLookupsSuccess = {
  state: 'resolved',
  value: {
    json: async () => ({}),
    status: 200
  }
}

const fetchFailed = {
  state: 'rejected',
  value: 'Error on fetch'
}

const unauthorizedError = {
  state: 'resolved',
  value: {
    json: async () => ({
      errcode: errCodes.unAuthorized,
      error: 'Unauthorized'
    }),
    status: 401
  }
}

type mockedRequest =
  | typeof getHashDetailsSuccess
  | typeof postLookupsSuccess
  | typeof unauthorizedError
  | typeof fetchFailed
  | typeof getHashDetailsNoAlgorithm
  | typeof getHashDetailsNoPepper
  | typeof errorOnParsingResponseBody

const mockPromiseAllSettled = (mocks: mockedRequest[]): void => {
  if (mocks.length < (conf.federated_identity_services as string[]).length)
    return
  mocks.forEach((mock, index) => {
    if (mocks[index].state === 'resolved') {
      fetchMock.mockResolvedValueOnce(mock.value)
    } else if (mocks[index].state === 'rejected') {
      fetchMock.mockRejectedValueOnce(mock.value)
    }
  })
}

const mockRequests = (mocks: mockedRequest[][], nbStep: number = 2): void => {
  for (let i = 0; i < nbStep; i++) {
    mockPromiseAllSettled(mocks[i])
  }
}

let userDB: UserDB
let spyOnLoggerError: jest.SpyInstance

beforeAll((done) => {
  userDB = new UserDB(conf, logger)
  spyOnLoggerError = jest.spyOn(logger, 'error')
  userDB.ready
    .then(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore run is a sqlite3 method only
      userDB.db.db.run(
        'CREATE TABLE IF NOT EXISTS users (uid varchar(8), mobile varchar(12), mail varchar(32))',
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

beforeEach(() => {
  jest.resetAllMocks()
})

afterAll(() => {
  if (fs.existsSync('./src/__testData__/hashes.db')) {
    fs.unlinkSync('./src/__testData__/hashes.db')
  }
  userDB.close()
  logger.close()
})

describe('updateFederatedIdentityHashes', () => {
  it('should be able to calculate and push hashes to federated identity service', async () => {
    const hash = new Hash()
    await hash.ready

    const mocks = [
      [
        getHashDetailsSuccess,
        getHashDetailsSuccess,
        getHashDetailsSuccessMultiplePeppers
      ],
      [
        postLookupsSuccess,
        postLookupsSuccess,
        postLookupsSuccess,
        postLookupsSuccess,
        postLookupsSuccess
      ]
    ]

    mockRequests(mocks)

    await updateFederatedIdentityHashes(conf, userDB, logger)

    const getExpectedLookupsRequestBody = (pepper: string): RequestInit => ({
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        algorithm: 'sha256',
        pepper,
        mappings: {
          'matrix.example.com:8448': [
            hash.sha256(`33612345678 msisdn ${pepper}`),
            hash.sha256(`dwho@company.com email ${pepper}`)
          ]
        }
      })
    })

    expect(fetchMock).toHaveBeenCalledTimes(8)
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      encodeURI(
        `https://federated-identity1.example.com/_matrix/identity/v2/lookups`
      ),
      getExpectedLookupsRequestBody(defaultPepper)
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      encodeURI(
        `https://federated-identity2.example.com/_matrix/identity/v2/lookups`
      ),
      getExpectedLookupsRequestBody(defaultPepper)
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      encodeURI(
        `https://federated-identity3.example.com/_matrix/identity/v2/lookups`
      ),
      getExpectedLookupsRequestBody(defaultPepper)
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      encodeURI(
        `https://federated-identity3.example.com/_matrix/identity/v2/lookups`
      ),
      getExpectedLookupsRequestBody(altPeppers[0])
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      encodeURI(
        `https://federated-identity3.example.com/_matrix/identity/v2/lookups`
      ),
      getExpectedLookupsRequestBody(altPeppers[1])
    )
  })

  describe('Error cases', () => {
    it('should log error on get hash details rejected and it does not stop execution', async () => {
      const mocks = [
        [getHashDetailsSuccess, fetchFailed, getHashDetailsSuccess],
        [postLookupsSuccess, postLookupsSuccess, postLookupsSuccess]
      ]

      mockRequests(mocks)

      await updateFederatedIdentityHashes(conf, userDB, logger)
      expect(spyOnLoggerError).toHaveBeenCalledTimes(1)
      expect(spyOnLoggerError).toHaveBeenCalledWith(
        `[Update federated identity service hashes] Request to get pepper and algorithms from federated identity service federated-identity2.example.com failed. Reason: ${fetchFailed.value}`
      )
      expect(fetchMock).toHaveBeenCalledTimes(5)
    })

    it('should log error if parsing response body of get hash details fails', async () => {
      const mocks = [
        [
          getHashDetailsSuccess,
          errorOnParsingResponseBody,
          getHashDetailsSuccess
        ],
        [postLookupsSuccess, postLookupsSuccess, postLookupsSuccess]
      ]

      mockRequests(mocks)

      await updateFederatedIdentityHashes(conf, userDB, logger)
      expect(spyOnLoggerError).toHaveBeenCalledTimes(1)
      expect(spyOnLoggerError).toHaveBeenCalledWith(
        new Error(
          `[Update federated identity service hashes] Error on parsing response body of request to get pepper and algorithm from federated-identity2.example.com. Reason: Error: Error on parsing response body`
        )
      )
      expect(fetchMock).toHaveBeenCalledTimes(5)
    })

    it('should log error on parsing get hash details response body if it contains "errcode" key', async () => {
      const mocks = [
        [unauthorizedError, unauthorizedError, getHashDetailsSuccess],
        [postLookupsSuccess, postLookupsSuccess, postLookupsSuccess]
      ]

      mockRequests(mocks)

      await updateFederatedIdentityHashes(conf, userDB, logger)
      expect(spyOnLoggerError).toHaveBeenCalledTimes(2)
      for (let i = 1; i <= 2; i++) {
        expect(spyOnLoggerError).toHaveBeenNthCalledWith(
          i,
          new Error(
            `[Update federated identity service hashes] Error in response body of request to get pepper and algorithm from federated-identity${i}.example.com. Reason: Unauthorized`
          )
        )
      }
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    it('should log error on parsing get hash details response body if "algorithms" field does not have a correct value', async () => {
      const mocks = [
        [getHashDetailsSuccess, getHashDetailsNoAlgorithm, unauthorizedError],
        [postLookupsSuccess, postLookupsSuccess, postLookupsSuccess]
      ]

      mockRequests(mocks)

      await updateFederatedIdentityHashes(conf, userDB, logger)
      expect(spyOnLoggerError).toHaveBeenCalledTimes(2)
      expect(spyOnLoggerError).toHaveBeenNthCalledWith(
        1,
        new Error(
          '[Update federated identity service hashes] Error federated-identity2.example.com did not provide algorithms'
        )
      )
      expect(spyOnLoggerError).toHaveBeenNthCalledWith(
        2,
        new Error(
          `[Update federated identity service hashes] Error in response body of request to get pepper and algorithm from federated-identity3.example.com. Reason: Unauthorized`
        )
      )
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    it('should log error on parsing get hash details response body if "lookup_pepper" field value is null', async () => {
      const mocks = [
        [fetchFailed, getHashDetailsSuccess, getHashDetailsNoPepper],
        [postLookupsSuccess, postLookupsSuccess, postLookupsSuccess]
      ]

      mockRequests(mocks)

      await updateFederatedIdentityHashes(conf, userDB, logger)
      expect(spyOnLoggerError).toHaveBeenCalledTimes(2)
      expect(spyOnLoggerError).toHaveBeenNthCalledWith(
        1,
        `[Update federated identity service hashes] Request to get pepper and algorithms from federated identity service federated-identity1.example.com failed. Reason: ${fetchFailed.value}`
      )
      expect(spyOnLoggerError).toHaveBeenNthCalledWith(
        2,
        new Error(
          '[Update federated identity service hashes] Error federated-identity3.example.com did not provide lookup_pepper'
        )
      )
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    it('should log error on post updated hashes rejected and it does not stop execution', async () => {
      const mocks = [
        [getHashDetailsSuccess, getHashDetailsSuccess, getHashDetailsSuccess],
        [postLookupsSuccess, postLookupsSuccess, fetchFailed]
      ]

      mockRequests(mocks)

      await updateFederatedIdentityHashes(conf, userDB, logger)
      expect(fetchMock).toHaveBeenCalledTimes(6)
      expect(spyOnLoggerError).toHaveBeenCalledTimes(1)
      expect(spyOnLoggerError).toHaveBeenCalledWith(
        `[Update federated identity service hashes] Request to post updated hashes on federated-identity3.example.com failed. Reason: ${fetchFailed.value}`
      )
    })

    it('should log error if parsing response body of post updated hashes fails', async () => {
      const mocks = [
        [getHashDetailsSuccess, getHashDetailsSuccess, getHashDetailsSuccess],
        [postLookupsSuccess, errorOnParsingResponseBody, postLookupsSuccess]
      ]

      mockRequests(mocks)

      await updateFederatedIdentityHashes(conf, userDB, logger)
      expect(spyOnLoggerError).toHaveBeenCalledTimes(1)
      expect(spyOnLoggerError).toHaveBeenCalledWith(
        new Error(
          `[Update federated identity service hashes] Error on parsing response body of request to push updated hashes to federated-identity2.example.com. Reason: Error: Error on parsing response body`
        )
      )
      expect(fetchMock).toHaveBeenCalledTimes(6)
    })

    it('should log error on parsing post updated hashes response body if it contains "errcode" key', async () => {
      const mocks = [
        [getHashDetailsSuccess, getHashDetailsSuccess, getHashDetailsSuccess],
        [postLookupsSuccess, unauthorizedError, postLookupsSuccess]
      ]

      mockRequests(mocks)

      await updateFederatedIdentityHashes(conf, userDB, logger)
      expect(fetchMock).toHaveBeenCalledTimes(6)
      expect(spyOnLoggerError).toHaveBeenCalledTimes(1)
      expect(spyOnLoggerError).toHaveBeenCalledWith(
        new Error(
          `[Update federated identity service hashes] Error in response body of request to post updated hashes on federated-identity2.example.com. Reason: Unauthorized`
        )
      )
    })
  })
})
