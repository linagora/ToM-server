import { Hash } from '@twake/crypto'
import express from 'express'
import fs from 'fs'
import type * as http from 'http'
import path from 'path'
import request from 'supertest'
import FederationServer from '.'
import JEST_PROCESS_ROOT_PATH from '../jest.globals'
import { buildMatrixDb, buildUserDB } from './__testData__/build-userdb'
import defaultConfig from './__testData__/config.json'
import { type Config } from './types'

const pathToTestDataFolder = path.join(
  JEST_PROCESS_ROOT_PATH,
  'src',
  '__testData__'
)

const authToken =
  'authTokenddddddddddddddddddddddddddddddddddddddddddddddddddddddd'

jest.unmock('node-fetch')

describe('Federation server', () => {
  const hash = new Hash()

  beforeAll((done) => {
    hash.ready
      .then(() => {
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  describe('Mock tests', () => {
    let federationServer: FederationServer
    let app: express.Application
    let expressFederationServer: http.Server
    const testConfig = {
      ...(defaultConfig as Partial<Config>),
      additional_features: true,
      cron_service: true
    }
    const trustedIpAddress = '192.168.1.1'

    beforeAll((done) => {
      Promise.all([
        buildUserDB(testConfig as Config),
        buildMatrixDb(testConfig as Config)
      ])
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          federationServer = new FederationServer(testConfig)
          app = express()
          return federationServer.ready
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() =>
          federationServer.db.insert('accessTokens', {
            id: authToken,
            data: '{"sub": "@test:example.com"}'
          })
        )
        .then(() => {
          app.use(federationServer.routes)
          expressFederationServer = app.listen(3000, () => {
            done()
          })
        })
        .catch((e) => {
          done(e)
        })
    })

    afterAll((done) => {
      const filesToDelete: string[] = [
        path.join(pathToTestDataFolder, 'database.db'),
        path.join(pathToTestDataFolder, 'matrix.db'),
        path.join(pathToTestDataFolder, 'user.db')
      ]
      filesToDelete.forEach((path: string) => {
        if (fs.existsSync(path)) fs.unlinkSync(path)
      })
      if (federationServer != null) federationServer.cleanJobs()
      if (expressFederationServer != null) {
        expressFederationServer.close((e) => {
          if (e != null) {
            done(e)
          }
          done()
        })
      } else {
        done()
      }
    })

    beforeEach(() => {
      jest.restoreAllMocks()
    })

    describe('Working cases', () => {
      let hashDetails: {
        algorithms: ['sha256']
        lookup_pepper: string
      }
      let askywalkerHash: string
      let lskywalkerHash: string
      let okenobiHash: string

      beforeAll((done) => {
        request(app)
          .get('/_matrix/identity/v2/hash_details')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then((response) => {
            hashDetails = response.body as {
              algorithms: ['sha256']
              lookup_pepper: string
            }
            askywalkerHash = hash.sha256(
              `askywalker@example.com email ${hashDetails.lookup_pepper}`
            )
            lskywalkerHash = hash.sha256(
              `lskywalker@example.com email ${hashDetails.lookup_pepper}`
            )
            okenobiHash = hash.sha256(
              `okenobi@example.com email ${hashDetails.lookup_pepper}`
            )

            return Promise.all([
              request(app)
                .post('/_matrix/identity/v2/lookups')
                .set('Accept', 'application/json')
                .set('X-forwarded-for', trustedIpAddress)
                .send({
                  algorithm: hashDetails.algorithms[0],
                  pepper: hashDetails.lookup_pepper,
                  mappings: {
                    'identity1.example.com': [
                      {
                        hash: askywalkerHash,
                        active: 1
                      }
                    ]
                  }
                }),
              request(app)
                .post('/_matrix/identity/v2/lookups')
                .set('Accept', 'application/json')
                .set('X-forwarded-for', trustedIpAddress)
                .send({
                  algorithm: hashDetails.algorithms[0],
                  pepper: hashDetails.lookup_pepper,
                  mappings: {
                    'identity2.example.com': [
                      {
                        hash: lskywalkerHash,
                        active: 1
                      }
                    ]
                  }
                }),
              request(app)
                .post('/_matrix/identity/v2/lookups')
                .set('Accept', 'application/json')
                .set('X-forwarded-for', 'falsy_ip_address')
                .send({
                  algorithm: hashDetails.algorithms[0],
                  pepper: hashDetails.lookup_pepper,
                  mappings: {
                    'identity3.example.com': [
                      {
                        hash: okenobiHash,
                        active: 1
                      }
                    ]
                  }
                })
            ])
          })
          .then(() => {
            done()
          })
          .catch((e) => {
            done(e)
          })
      })

      it('should get server in which third party user is registered on lookup', async () => {
        const response = await request(app)
          .post('/_matrix/identity/v2/lookup')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            algorithm: hashDetails.algorithms[0],
            pepper: hashDetails.lookup_pepper,
            addresses: [lskywalkerHash]
          })
        expect(response.body).toHaveProperty('mappings', {})
        expect(response.body).toHaveProperty('inactive_mappings', {})
        expect(response.body).toHaveProperty('third_party_mappings')
        expect(response.body.third_party_mappings).toHaveProperty([
          'identity2.example.com'
        ])
        expect(
          response.body.third_party_mappings['identity2.example.com']
        ).toHaveProperty('inactives', [])
        expect(
          response.body.third_party_mappings['identity2.example.com']
        ).toHaveProperty('actives')
        expect(
          response.body.third_party_mappings['identity2.example.com'].actives
        ).toEqual(expect.arrayContaining([lskywalkerHash]))
      })

      it('should get user of federation server environment on lookup', async () => {
        let response = await request(app)
          .get('/_matrix/identity/v2/hash_details')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
        const hashDetails = response.body as {
          algorithms: ['sha256']
          lookup_pepper: string
        }
        const chewbaccaHash = hash.sha256(
          `chewbacca@example.com email ${hashDetails.lookup_pepper}`
        )
        response = await request(app)
          .post('/_matrix/identity/v2/lookup')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            algorithm: hashDetails.algorithms[0],
            pepper: hashDetails.lookup_pepper,
            addresses: [chewbaccaHash]
          })
        expect(response.body).toHaveProperty('inactive_mappings', {})
        expect(response.body).toHaveProperty('third_party_mappings', {})
        expect(response.body).toHaveProperty('mappings')
        expect(response.body.mappings).toHaveProperty(
          chewbaccaHash,
          '@chewbacca:example.com'
        )
      })

      it('should not find user from not trusted identity server on lookup', async () => {
        const response = await request(app)
          .post('/_matrix/identity/v2/lookup')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            algorithm: hashDetails.algorithms[0],
            pepper: hashDetails.lookup_pepper,
            addresses: [okenobiHash]
          })
        expect(response.body).toHaveProperty('inactive_mappings', {})
        expect(response.body).toHaveProperty('third_party_mappings', {})
        expect(response.body).toHaveProperty('mappings', {})
      })

      it('should not find user not connected on any matrix server on lookup', async () => {
        let response = await request(app)
          .get('/_matrix/identity/v2/hash_details')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
        const hashDetails = response.body as {
          algorithms: ['sha256']
          lookup_pepper: string
        }
        const qjinnHash = hash.sha256(
          `qjinn@example.com email ${hashDetails.lookup_pepper}`
        )
        response = await request(app)
          .post('/_matrix/identity/v2/lookup')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            algorithm: hashDetails.algorithms[0],
            pepper: hashDetails.lookup_pepper,
            addresses: [qjinnHash]
          })
        expect(response.body).toHaveProperty('inactive_mappings', {})
        expect(response.body).toHaveProperty('third_party_mappings', {})
        expect(response.body).toHaveProperty('mappings', {})
      })

      it('should find all servers on which a third party user is connected on lookup', async () => {
        await request(app)
          .post('/_matrix/identity/v2/lookups')
          .set('Accept', 'application/json')
          .set('X-forwarded-for', trustedIpAddress)
          .send({
            algorithm: hashDetails.algorithms[0],
            pepper: hashDetails.lookup_pepper,
            mappings: {
              'identity1.example.com': [
                {
                  hash: lskywalkerHash,
                  active: 1
                },
                {
                  hash: askywalkerHash,
                  active: 1
                }
              ]
            }
          })
        const response = await request(app)
          .post('/_matrix/identity/v2/lookup')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            algorithm: hashDetails.algorithms[0],
            pepper: hashDetails.lookup_pepper,
            addresses: [lskywalkerHash]
          })
        expect(response.body).toHaveProperty('mappings', {})
        expect(response.body).toHaveProperty('inactive_mappings', {})
        expect(response.body).toHaveProperty('third_party_mappings')
        expect(Object.keys(response.body.third_party_mappings)).toEqual(
          expect.arrayContaining([
            'identity1.example.com',
            'identity2.example.com'
          ])
        )
        const expected3PIDData = {
          actives: [lskywalkerHash],
          inactives: []
        }
        expect(
          JSON.stringify(
            response.body.third_party_mappings['identity1.example.com']
          )
        ).toEqual(JSON.stringify(expected3PIDData))
        expect(
          JSON.stringify(
            response.body.third_party_mappings['identity2.example.com']
          )
        ).toEqual(JSON.stringify(expected3PIDData))
      })

      it('should find all federation users and servers address of third party users on lookup', async () => {
        let response = await request(app)
          .get('/_matrix/identity/v2/hash_details')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
        const hashDetails = response.body as {
          algorithms: ['sha256']
          lookup_pepper: string
        }
        const chewbaccaHash = hash.sha256(
          `chewbacca@example.com email ${hashDetails.lookup_pepper}`
        )
        const qjinnHash = hash.sha256(
          `qjinn@example.com email ${hashDetails.lookup_pepper}`
        )
        response = await request(app)
          .post('/_matrix/identity/v2/lookup')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            algorithm: hashDetails.algorithms[0],
            pepper: hashDetails.lookup_pepper,
            addresses: [
              lskywalkerHash,
              chewbaccaHash,
              qjinnHash,
              okenobiHash,
              askywalkerHash
            ]
          })
        expect(response.body).toHaveProperty('inactive_mappings', {})
        expect(response.body).toHaveProperty('mappings')
        expect(response.body).toHaveProperty('third_party_mappings')
        expect(JSON.stringify(response.body.mappings)).toEqual(
          JSON.stringify({
            [chewbaccaHash]: '@chewbacca:example.com'
          })
        )
        expect(Object.keys(response.body.third_party_mappings)).toEqual(
          expect.arrayContaining([
            'identity1.example.com',
            'identity2.example.com'
          ])
        )
        expect(
          response.body.third_party_mappings['identity1.example.com']
        ).toHaveProperty('inactives', [])
        expect(
          response.body.third_party_mappings['identity1.example.com']
        ).toHaveProperty('actives')
        expect(
          response.body.third_party_mappings['identity1.example.com'].actives
        ).toEqual(expect.arrayContaining([askywalkerHash, lskywalkerHash]))

        expect(
          JSON.stringify(
            response.body.third_party_mappings['identity2.example.com']
          )
        ).toEqual(
          JSON.stringify({
            actives: [lskywalkerHash],
            inactives: []
          })
        )
      })
    })

    describe('Error cases', () => {
      const errorMessage = 'error message'

      it('reject unimplemented endpoint with 404', async () => {
        const response = await request(app).get('/unkown')
        expect(response.statusCode).toBe(404)
        expect(JSON.stringify(response.body)).toEqual(
          JSON.stringify({ errcode: 'M_NOT_FOUND', error: 'Not Found' })
        )
      })

      describe('Lookup endpoint', () => {
        it('reject not allowed method with 405 status code', async () => {
          const response = await request(app)
            .get('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)

          expect(response.statusCode).toBe(405)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({ errcode: 'M_UNRECOGNIZED', error: 'Unrecognized' })
          )
        })

        it('should send an error if auth token is invalid', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', 'falsy_token')
            .send({
              addresse: [],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(401)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({ errcode: 'M_UNAUTHORIZED', error: 'Unauthorized' })
          )
        })

        it('should send an error if auth token is not in accessTokens table', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken.replace('a', 'f')}`)
            .send({
              addresse: [],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(401)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({ errcode: 'M_UNAUTHORIZED', error: 'Unauthorized' })
          )
        })

        it('should send an error if token data in accessTokens table are invalid', async () => {
          jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValue([{ data: JSON.stringify({}) }])

          const jsonParseSpy = jest.spyOn(JSON, 'parse')

          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresse: [],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(jsonParseSpy).toHaveBeenNthCalledWith(2, '{}')
          expect(response.statusCode).toEqual(401)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({ errcode: 'M_UNAUTHORIZED', error: 'Unauthorized' })
          )
        })

        it('should send an error if "algorithm" is not in body', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: [],
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              error: 'Error field: Invalid value (property: algorithm)'
            })
          )
        })

        it('should send an error if "algorithm" is not a string', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: [],
              algorithm: 2,
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              error: 'Error field: Invalid value (property: algorithm)'
            })
          )
        })

        it('should send an error if "pepper" is not in body', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: [],
              algorithm: 'sha256'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              error: 'Error field: Invalid value (property: pepper)'
            })
          )
        })

        it('should send an error if "pepper" is not a string', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: [],
              algorithm: 'sha256',
              pepper: 2
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              error: 'Error field: Invalid value (property: pepper)'
            })
          )
        })

        it('should send an error if "addresses" is not in body', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              error: 'Error field: Invalid value (property: addresses)'
            })
          )
        })

        it('should send an error if "addresses" is not a string array', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: 2,
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              error: 'Error field: Invalid value (property: addresses)'
            })
          )
        })

        it('should send an error if one address is not a string', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: [
                '@dwho:example.com',
                '@rtyler:example.com',
                2,
                '@msmith:example.com'
              ],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              error:
                'Error field: One of the address is not a string (property: addresses)'
            })
          )
        })

        it('should send an error if getting hashes from db fails', async () => {
          jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValueOnce([
              { data: JSON.stringify({ sub: '@test:example.com' }) }
            ])
            .mockRejectedValueOnce(new Error(errorMessage))

          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: ['@dwho:example.com', '@rtyler:example.com'],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })

        it('should send an error if getting hashes from hashes table fails', async () => {
          const dbGetSpy = jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValueOnce([
              { data: JSON.stringify({ sub: '@test:example.com' }) }
            ])
            .mockRejectedValueOnce(new Error(errorMessage))

          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: ['@dwho:example.com', '@rtyler:example.com'],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(dbGetSpy).toHaveBeenCalledTimes(2)
          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })

        it('should send an error if getting hashes from hashbyserver table fails', async () => {
          const dbGetSpy = jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValueOnce([
              { data: JSON.stringify({ sub: '@test:example.com' }) }
            ])
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error(errorMessage))

          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: ['@dwho:example.com', '@rtyler:example.com'],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(dbGetSpy).toHaveBeenCalledTimes(3)
          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })
      })

      describe('Lookups endpoint', () => {
        it('reject not allowed method with 405 status code', async () => {
          const response = await request(app)
            .get('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)

          expect(response.statusCode).toBe(405)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({ errcode: 'M_UNRECOGNIZED', error: 'Unrecognized' })
          )
        })

        it('should send an error if requester ip does not belong to trusted ip addresses', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', 'falsy_ip_address')
            .send({
              mappings: {},
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(401)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({ errcode: 'M_UNAUTHORIZED', error: 'Unauthorized' })
          )
        })

        it('should send an error if "mappings" is not in body', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              error: 'Error field: Invalid value (property: mappings)'
            })
          )
        })

        it('should send an error if "mappings" is not an object', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: 2,
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              error: 'Error field: Invalid value (property: mappings)'
            })
          )
        })

        it('should send an error if "mappings" contains more than one server hostname', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: { 'test.example.com': [], 'test2.example.com': [] },
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              error:
                'Error field: Only one server address is allowed (property: mappings)'
            })
          )
        })

        it('should send an error if deleting hashes in hashbyserver table fails', async () => {
          const deleteEqualSpy = jest
            .spyOn(federationServer.db, 'deleteEqual')
            .mockRejectedValue(new Error(errorMessage))

          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: { 'test.example.com': [] },
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(deleteEqualSpy).toHaveBeenCalledTimes(1)
          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })

        it('should send an error if inserting hashes in hashbyserver table fails', async () => {
          jest.spyOn(federationServer.db, 'deleteEqual').mockResolvedValue()

          const insertSpyOn = jest
            .spyOn(federationServer.db, 'insert')
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error(errorMessage))
            .mockResolvedValueOnce([])

          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: {
                'test.example.com': ['test1', 'test2', 'test3', 'test4']
              },
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(insertSpyOn).toHaveBeenCalledTimes(4)
          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })
      })

      describe('Hash_details endpoint', () => {
        it('reject not allowed method with 405 status code', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/hash_details')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)

          expect(response.statusCode).toBe(405)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({ errcode: 'M_UNRECOGNIZED', error: 'Unrecognized' })
          )
        })

        it('should send an error if deleting hashes in hashbyserver table fails', async () => {
          jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValueOnce([
              { data: JSON.stringify({ sub: '@test:example.com' }) }
            ])
            .mockRejectedValueOnce(new Error(errorMessage))

          const response = await request(app)
            .get('/_matrix/identity/v2/hash_details')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)

          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })
      })
    })
  })
})
