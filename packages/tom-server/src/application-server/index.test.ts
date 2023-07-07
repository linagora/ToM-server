import { type DbGetResult } from '@twake/matrix-identity-server'
import express from 'express'
import fs from 'fs'
import type * as http from 'http'
import ldapjs from 'ldapjs'
import * as fetch from 'node-fetch'
import os from 'os'
import path from 'path'
import request from 'supertest'
import {
  DockerComposeEnvironment,
  GenericContainer,
  Wait,
  type StartedDockerComposeEnvironment,
  type StartedTestContainer
} from 'testcontainers'
import TwakeServer from '..'
import JEST_PROCESS_ROOT_PATH from '../../jest.globals'
import { allMatrixErrorCodes, type Collections, type Config } from '../types'
import { addUser, buildUserDB, deleteUserDB } from './__testData__/build-userdb'
import defaultConfig from './__testData__/config.json'
import { TwakeRoom } from './models/room'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const syswideCas = require('@small-tech/syswide-cas')

const pathToTestDataFolder = path.join(
  JEST_PROCESS_ROOT_PATH,
  'src',
  'application-server',
  '__testData__'
)
const pathToSynapseDataFolder = path.join(pathToTestDataFolder, 'synapse-data')

const authToken =
  'authTokenddddddddddddddddddddddddddddddddddddddddddddddddddddddd'

jest.unmock('node-fetch')

describe('ApplicationServer', () => {
  const ldapHostPort = 21389
  const twakeServerPort = 3000
  let twakeServer: TwakeServer
  let app: express.Application
  let expressTwakeServer: http.Server
  let startedLdap: StartedTestContainer
  let startedCompose: StartedDockerComposeEnvironment
  let testConfig = defaultConfig as Partial<Config>

  beforeAll((done) => {
    GenericContainer.fromDockerfile(path.join(pathToTestDataFolder, 'ldap'))
      .build()
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((builtContainer) => {
        return builtContainer
          .withExposedPorts({
            container: 389,
            host: ldapHostPort
          })
          .start()
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((startedContainer) => {
        const interfaces = os.networkInterfaces()
        const hostNetworkInterface = Object.keys(interfaces)
          .reduce<os.NetworkInterfaceInfo[]>((acc, key) => {
            return interfaces[key] != null
              ? [...acc, ...(interfaces[key] as os.NetworkInterfaceInfo[])]
              : acc
          }, [])
          .find(
            (networkInterface) =>
              networkInterface.family === 'IPv4' && !networkInterface.internal
          ) as os.NetworkInterfaceInfo
        startedLdap = startedContainer
        testConfig = {
          ...testConfig,
          base_url: `http://${hostNetworkInterface.address}:${twakeServerPort}/`,
          ldap_uri: `ldap://${startedLdap.getHost()}:${ldapHostPort}/`
        }
        return buildUserDB(testConfig)
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        twakeServer = new TwakeServer(testConfig)
        app = express()
        return twakeServer.ready
      })
      .then(() => {
        app.use(twakeServer.endpoints)
        expressTwakeServer = app.listen(twakeServerPort, () => {
          done()
        })
      })
      .catch((e) => {
        console.log(e)
        done(e)
      })
  })

  afterAll((done) => {
    const filesToDelete = [
      path.join(pathToTestDataFolder, 'test.db'),
      path.join(pathToSynapseDataFolder, 'registration.yaml'),
      path.join(pathToSynapseDataFolder, 'homeserver.db'),
      path.join(pathToSynapseDataFolder, 'matrix.example.com.signing.key')
    ]
    filesToDelete.forEach((path: string) => {
      if (fs.existsSync(path)) fs.unlinkSync(path)
    })
    if (twakeServer != null) twakeServer.cleanJobs()
    if (startedLdap != null) {
      startedLdap
        .stop()
        .then(() => {
          if (expressTwakeServer != null) {
            expressTwakeServer.close((e) => {
              if (e != null) {
                console.log(e)
                done(e)
              }
              done()
            })
          }
        })
        .catch((e) => {
          console.log(e)
          done(e)
        })
    } else {
      done()
    }
  })

  describe('Integration tests', () => {
    beforeAll((done) => {
      syswideCas.addCAs(
        path.join(
          pathToTestDataFolder,
          'nginx',
          'ssl',
          'matrix.example.com.crt'
        )
      )
      syswideCas.addCAs(
        path.join(pathToTestDataFolder, 'nginx', 'ssl', 'auth.example.com.crt')
      )
      deleteUserDB(testConfig)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((_) => {
          return new DockerComposeEnvironment(
            path.join(pathToTestDataFolder),
            'docker-compose.yml'
          )
            .withEnvironment({ MYUID: os.userInfo().uid.toString() })
            .withWaitStrategy('synapse_1', Wait.forHealthCheck())
            .up()
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((upResult) => {
          startedCompose = upResult
          return addUser(testConfig, '@dwho:example.com')
        })
        .then(done)
        .catch((e) => {
          console.log(e)
          done(e)
        })
    })

    afterAll((done) => {
      const filesToDelete = [
        path.join(pathToSynapseDataFolder, 'homeserver.log'),
        path.join(pathToSynapseDataFolder, 'homeserver.db-shm'),
        path.join(pathToSynapseDataFolder, 'homeserver.db-wal')
      ]
      filesToDelete.forEach((path: string) => {
        if (fs.existsSync(path)) fs.unlinkSync(path)
      })
      if (startedCompose != null) {
        startedCompose
          .down()
          .then(() => {
            done()
          })
          .catch((e) => {
            console.log(e)
            done(e)
          })
      } else {
        done()
      }
    })

    it('should create room and force users matching the filter to join the new room', async () => {
      const response = await request(app)
        .post('/_twake/app/v1/rooms')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'room1',
          visibility: 'public',
          aliasName: 'r1',
          topic: 'test room',
          ldapFilter: {
            mail: 'dwho@example.com'
          }
        })
      expect(response.statusCode).toBe(200)
      expect(response.body).toEqual({})
      const rooms = await twakeServer.db?.getAll(
        'rooms' as unknown as Collections,
        ['*']
      )
      expect(rooms).not.toBeUndefined()
      expect((rooms as DbGetResult).length).toEqual(1)
      const newRoom = (rooms as DbGetResult)[0]
      expect(newRoom.filter).toEqual(
        JSON.stringify({
          mail: 'dwho@example.com'
        })
      )
      const membersIds = await twakeServer.matrixDb.get(
        'room_memberships',
        ['user_id'],
        { room_id: newRoom.id }
      )
      expect(membersIds).not.toBeUndefined()
      expect(membersIds.length).toEqual(2)
      expect(membersIds[1].user_id).toEqual('@dwho:example.com')
    })

  })

  describe('Tests with mocks', () => {
    beforeEach(() => {
      jest.restoreAllMocks()
    })

    describe('On create room', () => {
      const matrixServerErrorMessage = 'error message from Matrix server'

      it('should send an error when request body is malformed', async () => {
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: false,
            visibility: 'test',
            aliasName: '_twake_r2',
            topic: 'test room'
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toEqual({
          error:
            'Error field: Invalid value (property: name), Error field: visibility should equal to "private" or "public" (property: visibility), Error field: Invalid value (property: ldapFilter)'
        })
      })

      it('should send an error when matrix server does not match hostname regex', async () => {
        const defaultMatrixServer = twakeServer.conf.matrix_server
        twakeServer.conf.matrix_server = 'falsy_matrix_server'
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(500)
        expect(response.body).toEqual({ error: 'Bad matrix_server_name' })
        twakeServer.conf.matrix_server = defaultMatrixServer
      })

      it('should send an error when get matrix room_aliases throws an error', async () => {
        const errorMessage = 'Error on getting room_aliases'
        jest
          .spyOn(twakeServer.matrixDb, 'get')
          .mockRejectedValue(new Error(errorMessage))
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(500)
        expect(response.body).toEqual({ error: errorMessage })
      })

      it('should send an error when get matrix room_aliases returns more than one room', async () => {
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([
          {
            room_alias: '#_twake_r3:example.com',
            room_id: '!test3:example.com',
            creator: '@bob:example.com'
          },
          {
            room_alias: '#_twake_r4:example.com',
            room_id: '!test4:example.com',
            creator: '@tom:example.com'
          }
        ])
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(500)
        expect(response.body).toEqual({
          error:
            'Critical error: several rooms have the same alias in Matrix database'
        })
      })

      it('should send an error when room creator of an existing room on matrix server is not the application app service', async () => {
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([
          {
            room_alias: '#_twake_r2:example.com',
            room_id: '!test3:example.com',
            creator: '@bob:example.com'
          }
        ])
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(409)
        expect(response.body).toEqual({
          errcode: allMatrixErrorCodes.roomInUse,
          error: 'A room with alias _twake_r2 already exists in Matrix database'
        })
      })

      it('should send an error when matrix server responds with an error on create room request', async () => {
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest
          .spyOn(fetch, 'default')
          .mockRejectedValue(new Error(matrixServerErrorMessage))
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(500)
        expect(response.body).toEqual({ error: matrixServerErrorMessage })
      })

      it('should send an error when parsing matrix server response of create room request throws an error', async () => {
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockResolvedValue({
          json: async () => {
            throw new Error('error on parsing response body')
          },
          status: 200
        } as unknown as fetch.Response)
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(500)
        expect(response.body).toEqual({
          error: 'error on parsing response body'
        })
      })

      it('should send an error when matrix server response body of create room contains errcode field', async () => {
        const matrixServerError = {
          errcode: allMatrixErrorCodes.notJson,
          error: 'Json is malformed'
        }
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockResolvedValue({
          json: async () => matrixServerError,
          status: 400
        } as unknown as fetch.Response)
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toEqual(matrixServerError)
      })

      it('should send an error when getRoom method throws an error', async () => {
        const errorOnGettingRoom = 'error on getting room'
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockResolvedValue({
          json: async () => ({
            room_id: 'room2'
          }),
          status: 200
        } as unknown as fetch.Response)
        jest
          .spyOn(TwakeRoom, 'getRoom')
          .mockRejectedValue(new Error(errorOnGettingRoom))
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(500)
        expect(response.body).toEqual({
          error: errorOnGettingRoom
        })
      })

      it('should send an error on creating a room that already exists', async () => {
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([
          {
            room_alias: '#_twake_r2:example.com',
            room_id: '!test2:example.com',
            creator: '@twake:example.com'
          }
        ])
        jest
          .spyOn(TwakeRoom, 'getRoom')
          .mockResolvedValue(
            new TwakeRoom('!test2:example.com', { test: 'test' })
          )
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(409)
        expect(response.body).toEqual({
          error: 'This room already exits in Twake database'
        })
      })

      it('should send an error when updateRoom method throws an error', async () => {
        const errorOnUpdatingRoom = 'error on updating room'
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockResolvedValue({
          json: async () => ({
            room_id: 'room2'
          }),
          status: 200
        } as unknown as fetch.Response)
        jest
          .spyOn(TwakeRoom, 'getRoom')
          .mockResolvedValue(
            new TwakeRoom('!test2:example.com', { test: 'test' })
          )
        jest
          .spyOn(TwakeRoom.prototype, 'updateRoom')
          .mockRejectedValue(new Error(errorOnUpdatingRoom))
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(500)
        expect(response.body).toEqual({
          error: errorOnUpdatingRoom
        })
      })

      it('should send an error when saveRoom method throws an error', async () => {
        const errorOnSavingRoom = 'error on saving room'
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockResolvedValue({
          json: async () => ({
            room_id: 'room2'
          }),
          status: 200
        } as unknown as fetch.Response)
        jest
          .spyOn(TwakeRoom.prototype, 'saveRoom')
          .mockRejectedValue(new Error(errorOnSavingRoom))
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(500)
        expect(response.body).toEqual({
          error: errorOnSavingRoom
        })
      })

      it('should send an error when getting users matching filter throws an error', async () => {
        const errorOnGettingUsers = 'error on getting users'
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockResolvedValue({
          json: async () => ({
            room_id: 'room2'
          }),
          status: 200
        } as unknown as fetch.Response)
        jest
          .spyOn(twakeServer.idServer.userDB, 'get')
          .mockRejectedValue(new Error(errorOnGettingUsers))
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(500)
        expect(response.body).toEqual({
          error: errorOnGettingUsers
        })
      })

      it('should not send an error when optional fields are missing in request body', async () => {
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockResolvedValueOnce({
          json: async () => ({
            room_id: 'room2'
          }),
          status: 200
        } as unknown as fetch.Response)
        jest.spyOn(twakeServer.idServer.userDB, 'get').mockResolvedValue([])
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            aliasName: '_twake_r2',
            ldapFilter: {
              mail: 'bb8@example.com'
            }
          })
        expect(response.statusCode).toBe(200)
      })

      it('should send a response whose body contains each error returns by matrix server on force join', async () => {
        const errorOnForcingJoin = {
          errcode: allMatrixErrorCodes.forbidden,
          error: 'error on forcing join'
        }
        const matrixServerError = new Error(matrixServerErrorMessage)
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest
          .spyOn(fetch, 'default')
          .mockResolvedValueOnce({
            json: async () => ({
              room_id: 'room2'
            }),
            status: 200
          } as unknown as fetch.Response)
          .mockResolvedValueOnce({
            json: async () => ({
              room_id: 'room2'
            }),
            status: 200
          } as unknown as fetch.Response)
          .mockRejectedValueOnce(matrixServerError)
          .mockResolvedValueOnce({
            json: async () => errorOnForcingJoin,
            status: 403
          } as unknown as fetch.Response)
          .mockRejectedValueOnce(new Error())
        jest
          .spyOn(twakeServer.idServer.userDB, 'get')
          .mockResolvedValue([
            { uid: 'user1' },
            { uid: 'user2' },
            { uid: 'user3' },
            { uid: 'user4' }
          ])
        const response = await request(app)
          .post('/_twake/app/v1/rooms')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'room2',
            visibility: 'public',
            aliasName: '_twake_r2',
            topic: 'test room',
            ldapFilter: {
              email: 'dwho@example.com'
            }
          })
        expect(response.statusCode).toBe(200)
        expect(response.body).toEqual([
          {
            uid: 'user2',
            errcode: allMatrixErrorCodes.unknown,
            error: { ...matrixServerError }
          },
          { uid: 'user3', ...errorOnForcingJoin },
          {
            uid: 'user4',
            errcode: allMatrixErrorCodes.unknown,
            error: { ...new Error() }
          }
        ])
      })
    })
  })
})
