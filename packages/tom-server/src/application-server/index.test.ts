import { type TwakeLogger } from '@twake/logger'
import { type AppServiceOutput } from '@twake/matrix-application-server/src/utils'
import { type DbGetResult } from '@twake/matrix-identity-server'
import express from 'express'
import fs from 'fs'
import type * as http from 'http'
import { load } from 'js-yaml'
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
import AppServiceAPI from '.'
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

const mockLogger: Partial<TwakeLogger> = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}

describe('ApplicationServer', () => {
  const ldapHostPort = 21389
  const twakeServerPort = 3000
  let twakeServer: TwakeServer
  let app: express.Application
  let expressTwakeServer: http.Server
  let startedLdap: StartedTestContainer
  let startedCompose: StartedDockerComposeEnvironment
  let testConfig = defaultConfig as Partial<Config>

  const simulationConnection = async (
    username: string,
    password: string
  ): Promise<string | undefined> => {
    try {
      let response = await fetch.default(
        encodeURI(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/login`
        )
      )
      let body = (await response.json()) as any
      const providerId = body.flows[0].identity_providers[0].id
      response = await fetch.default(
        encodeURI(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `https://${twakeServer.conf.matrix_server}/_matrix/client/r0/login/sso/redirect/${providerId}?redirectUrl=http://localhost:9876`
        ),
        {
          redirect: 'manual'
        }
      )
      let location = response.headers.get('location') as string
      const matrixCookies = response.headers.get('set-cookie')
      response = await fetch.default(location)
      body = await response.text()
      const hiddenInputFieldsWithValue = [
        ...(body as string).matchAll(/<input.*name="(\S+?)".*value="(\S+?)"/g)
      ]
        .map((matchElt) => `${matchElt[1]}=${matchElt[2]}&`)
        .join('')
      const formWithToken = `${hiddenInputFieldsWithValue}user=${username}&password=${password}`
      response = await fetch.default(location, {
        method: 'POST',
        body: new URLSearchParams(formWithToken),
        redirect: 'manual'
      })
      location = response.headers.get('location') as string
      response = await fetch.default(location, {
        headers: {
          cookie: matrixCookies as string
        }
      })
      body = await response.text()
      const loginTokenValue = [
        ...(body as string).matchAll(/loginToken=(\S+?)"/g)
      ][0][1]
      response = await fetch.default(
        encodeURI(
          `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/login`
        ),
        {
          method: 'POST',
          body: JSON.stringify({
            initial_device_display_name: 'Jest Test Client',
            token: loginTokenValue,
            type: 'm.login.token'
          })
        }
      )
      return ((await response.json()) as any).access_token as string
    } catch (e) {
      console.log(e)
    }
  }

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
    let appServiceToken: string
    let newRoomId: string
    let rSkywalkerMatrixToken: string
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
      appServiceToken = (
        load(
          fs.readFileSync(testConfig.registration_file_path as string, {
            encoding: 'utf8'
          })
        ) as AppServiceOutput
      ).as_token
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
          return addUser(testConfig, [
            '@askywalker:example.com',
            '@dwho:example.com'
          ])
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

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const getUserRoomMembership = (
      roomId: string,
      userId: string
    ): Promise<DbGetResult> => {
      return new Promise<DbGetResult>((resolve, reject) => {
        setTimeout(() => {
          twakeServer.matrixDb
            .get('room_memberships', ['membership'], {
              user_id: userId,
              room_id: roomId
            })
            .then((memberships) => {
              resolve(memberships)
            })
            .catch((e) => {
              console.log(e)
              reject(e)
            })
        }, 3000)
      })
    }

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
            mail: ['*skywalker@example.com', 'dwho@example.com']
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
      newRoomId = newRoom.id as string
      expect(newRoom.filter).toEqual(
        JSON.stringify({
          mail: ['*skywalker@example.com', 'dwho@example.com']
        })
      )
      const membersIds = await twakeServer.matrixDb.get(
        'room_memberships',
        ['user_id'],
        { room_id: newRoomId }
      )
      expect(membersIds).not.toBeUndefined()
      expect(membersIds.length).toEqual(3)
      expect(membersIds[1].user_id).toEqual('@dwho:example.com')
      expect(membersIds[2].user_id).toEqual('@askywalker:example.com')
    })

    it('should force user to join room on login', (done) => {
      twakeServer.matrixDb
        .get('room_memberships', ['user_id'], {
          room_id: newRoomId
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((membersIds) => {
          expect(membersIds.length).toEqual(3)
          expect(membersIds[0].user_id).toEqual('@twake:example.com')
          expect(membersIds[1].user_id).toEqual('@dwho:example.com')
          expect(membersIds[2].user_id).toEqual('@askywalker:example.com')
          const client = ldapjs.createClient({
            url: `ldap://${startedLdap.getHost()}:${ldapHostPort}/`
          })
          client.bind('cn=admin,dc=example,dc=com', 'admin', (err) => {
            if (err != null) {
              console.error(err)
            }
          })
          client.add(
            'uid=rskywalker,ou=users,dc=example,dc=com',
            {
              objectClass: 'inetOrgPerson',
              uid: 'rskywalker',
              cn: 'Rey Skywalker',
              sn: 'Rskywalker',
              mail: 'rskywalker@example.com',
              userPassword: 'rskywalker'
            },
            (err) => {
              if (err != null) {
                console.error(err)
              }
              client.destroy()
            }
          )
          return simulationConnection('rskywalker', 'rskywalker')
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((token) => {
          rSkywalkerMatrixToken = token as string
          return fetch.default(
            encodeURI(
              `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/sync`
            ),
            {
              headers: {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                Authorization: `Bearer ${token}`
              }
            }
          )
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return new Promise<DbGetResult>((resolve, reject) => {
            setTimeout(() => {
              twakeServer.matrixDb
                .get('room_memberships', ['user_id'], {
                  room_id: newRoomId
                })
                .then((memberships) => {
                  resolve(memberships)
                })
                .catch((e) => {
                  console.log(e)
                  reject(e)
                })
            }, 3000)
          })
        })
        .then((membersIds) => {
          expect(membersIds.length).toEqual(4)
          expect(membersIds[3].user_id).toEqual('@rskywalker:example.com')
          done()
        })
        .catch((e) => {
          console.log(e)
          done(e)
        })
    })

    it('should join again room if user tries to leave', (done) => {
      fetch
        .default(
          encodeURI(
            `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/rooms/${newRoomId}/leave`
          ),
          {
            method: 'POST',
            headers: {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              Authorization: `Bearer ${rSkywalkerMatrixToken}`
            }
          }
        )
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return getUserRoomMembership(newRoomId, '@rskywalker:example.com')
        })
        .then((memberships) => {
          expect(memberships.length).toEqual(3)
          expect(memberships[0].membership).toEqual('join')
          expect(memberships[1].membership).toEqual('leave')
          expect(memberships[2].membership).toEqual('join')
          done()
        })
        .catch((e) => {
          console.log(e)
          done(e)
        })
    })

    it("should not be able to kick another member if he is not the room's creator", (done) => {
      fetch
        .default(
          encodeURI(
            `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/rooms/${newRoomId}/kick`
          ),
          {
            method: 'POST',
            headers: {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              Authorization: `Bearer ${rSkywalkerMatrixToken}`
            },
            body: JSON.stringify({
              user_id: '@askywalker:example.com'
            })
          }
        )
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return getUserRoomMembership(newRoomId, '@askywalker:example.com')
        })
        .then((memberships) => {
          expect(memberships.length).toEqual(1)
          expect(memberships[0].membership).toEqual('join')
          done()
        })
        .catch((e) => {
          console.log(e)
          done(e)
        })
    })

    it("should not join room on login if user has been kicked by room's creator", (done) => {
      fetch
        .default(
          encodeURI(
            `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/rooms/${newRoomId}/kick`
          ),
          {
            method: 'POST',
            headers: {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              Authorization: `Bearer ${appServiceToken}`
            },
            body: JSON.stringify({
              user_id: '@rskywalker:example.com'
            })
          }
        )
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return getUserRoomMembership(newRoomId, '@rskywalker:example.com')
        })
        .then((memberships) => {
          expect(memberships.length).toEqual(4)
          expect(memberships[0].membership).toEqual('join')
          expect(memberships[1].membership).toEqual('leave')
          expect(memberships[2].membership).toEqual('join')
          expect(memberships[3].membership).toEqual('leave')
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return fetch.default(
            encodeURI(
              `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/sync`
            ),
            {
              headers: {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                Authorization: `Bearer ${rSkywalkerMatrixToken}`
              }
            }
          )
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return getUserRoomMembership(newRoomId, '@rskywalker:example.com')
        })
        .then((memberships) => {
          expect(memberships.length).toEqual(4)
          expect(memberships[0].membership).toEqual('join')
          expect(memberships[1].membership).toEqual('leave')
          expect(memberships[2].membership).toEqual('join')
          expect(memberships[3].membership).toEqual('leave')
          done()
        })
        .catch((e) => {
          console.log(e)
          done(e)
        })
    })

    it("should not join room on login if user has been banned by room's creator", (done) => {
      fetch
        .default(
          encodeURI(
            `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/rooms/${newRoomId}/ban`
          ),
          {
            method: 'POST',
            headers: {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              Authorization: `Bearer ${appServiceToken}`
            },
            body: JSON.stringify({
              user_id: '@askywalker:example.com'
            })
          }
        )
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return getUserRoomMembership(newRoomId, '@askywalker:example.com')
        })
        .then((memberships) => {
          expect(memberships.length).toEqual(2)
          expect(memberships[0].membership).toEqual('join')
          expect(memberships[1].membership).toEqual('ban')
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => simulationConnection('askywalker', 'askywalker'))
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((token) => {
          return fetch.default(
            encodeURI(
              `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/sync`
            ),
            {
              headers: {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                Authorization: `Bearer ${token}`
              }
            }
          )
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return getUserRoomMembership(newRoomId, '@askywalker:example.com')
        })
        .then((memberships) => {
          expect(memberships.length).toEqual(2)
          expect(memberships[0].membership).toEqual('join')
          expect(memberships[1].membership).toEqual('ban')
          done()
        })
        .catch((e) => {
          console.log(e)
          done(e)
        })
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

      it('should send an error when getting all matrix users throws an error', async () => {
        const errorOnGettingUsers = 'error on getting users'
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockResolvedValue({
          json: async () => ({
            room_id: 'room2'
          }),
          status: 200
        } as unknown as fetch.Response)
        jest.spyOn(twakeServer.idServer.userDB, 'get').mockResolvedValue([])
        jest
          .spyOn(twakeServer.matrixDb, 'getAll')
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

      it('should not send force join request if there is no shared user between LDAP and Matrix users', async () => {
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        const spyOnFetch = jest.spyOn(fetch, 'default').mockResolvedValue({
          json: async () => ({
            room_id: 'room2'
          }),
          status: 200
        } as unknown as fetch.Response)
        jest.spyOn(twakeServer.idServer.userDB, 'get').mockResolvedValue([])
        jest.spyOn(twakeServer.matrixDb, 'getAll').mockResolvedValue([])
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
        expect(spyOnFetch).toHaveBeenCalledTimes(1)
        expect(response.statusCode).toBe(200)
      })

      it('should not send an error when optional fields are missing in request body', async () => {
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockResolvedValueOnce({
          json: async () => ({
            room_id: 'room2'
          }),
          status: 200
        } as unknown as fetch.Response)
        jest
          .spyOn(twakeServer.idServer.userDB, 'get')
          .mockResolvedValue([
            { uid: 'user1' },
            { uid: 'user2' },
            { uid: 'user3' },
            { uid: 'user4' }
          ])
        jest.spyOn(twakeServer.matrixDb, 'getAll').mockResolvedValue([])
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
        jest
          .spyOn(twakeServer.matrixDb, 'getAll')
          .mockResolvedValue([
            { name: '@user1:example.com' },
            { name: '@user2:example.com' },
            { name: '@user3:example.com' },
            { name: '@user4:example.com' }
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
            uid: '@user2:example.com',
            errcode: allMatrixErrorCodes.unknown,
            error: { ...matrixServerError }
          },
          { uid: '@user3:example.com', ...errorOnForcingJoin },
          {
            uid: '@user4:example.com',
            errcode: allMatrixErrorCodes.unknown,
            error: { ...new Error() }
          }
        ])
      })
    })

    describe('on login', () => {
      it('should log an error when m.presence event sender is not found in user database', (done) => {
        const ldapUid = 'test'
        const appService = new AppServiceAPI(
          twakeServer,
          undefined,
          mockLogger as TwakeLogger
        )
        jest.spyOn(twakeServer.idServer.userDB, 'get').mockResolvedValue([])
        jest.spyOn(TwakeRoom, 'getAllRooms').mockResolvedValue([])
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        appService.emit('ephemeral_type: m.presence', {
          content: {
            avatar_url: 'mxc://localhost/wefuiwegh8742w',
            currently_active: false,
            last_active_ago: 2478593,
            presence: 'online',
            status_msg: 'Making cupcakes'
          },
          sender: '@test:localhost',
          type: 'm.presence'
        })
        setTimeout(() => {
          expect(mockLogger.error).toHaveBeenCalledTimes(1)
          expect(mockLogger.error).toHaveBeenCalledWith(
            new Error(
              `User with ${
                twakeServer.conf.ldap_uid_field as string
              } ${ldapUid} not found`
            )
          )
          done()
        }, 3000)
      })

      it('should complete all join requests even if an error occurs', (done) => {
        const appService = new AppServiceAPI(
          twakeServer,
          undefined,
          mockLogger as TwakeLogger
        )
        jest
          .spyOn(fetch, 'default')
          .mockResolvedValueOnce(new fetch.Response())
          .mockRejectedValueOnce(new Error())
          .mockResolvedValueOnce(new fetch.Response())
        jest.spyOn(twakeServer.idServer.userDB, 'get').mockResolvedValue([
          {
            objectClass: 'inetOrgPerson',
            uid: 'bb8',
            cn: 'BB8',
            sn: 'BB8',
            mail: 'bb8@example.com',
            userPassword: 'bb8'
          }
        ])
        jest
          .spyOn(TwakeRoom, 'getAllRooms')
          .mockResolvedValue([
            new TwakeRoom('room1', { mail: 'bb8@example.com' }),
            new TwakeRoom('room2', { cn: 'BB8' }),
            new TwakeRoom('room3', { uid: 'bb8' })
          ])
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        appService.emit('ephemeral_type: m.presence', {
          content: {
            avatar_url: 'mxc://localhost/wefuiwegh8742w',
            currently_active: false,
            last_active_ago: 2478593,
            presence: 'online',
            status_msg: 'Making cupcakes'
          },
          sender: '@test:localhost',
          type: 'm.presence'
        })
        setTimeout(() => {
          expect(mockLogger.error).not.toHaveBeenCalled()
          done()
        }, 3000)
      })

      it('should force join only to rooms whose sender is not member yet', (done) => {
        const appService = new AppServiceAPI(twakeServer)
        const spyOnFetch = jest
          .spyOn(fetch, 'default')
          .mockResolvedValue(new fetch.Response())
        jest.spyOn(twakeServer.idServer.userDB, 'get').mockResolvedValue([
          {
            objectClass: 'inetOrgPerson',
            uid: 'bb8',
            cn: 'BB8',
            sn: 'BB8',
            mail: 'bb8@example.com',
            userPassword: 'bb8'
          }
        ])
        jest
          .spyOn(TwakeRoom, 'getAllRooms')
          .mockResolvedValue([
            new TwakeRoom('room1', { mail: 'bb8@example.com' }),
            new TwakeRoom('room2', { cn: 'BB8' }),
            new TwakeRoom('room3', { mail: 'bb1@example.com' }),
            new TwakeRoom('room4', { uid: 'bb8' })
          ])
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([
          {
            room_id: 'room1',
            membership: 'join'
          },
          {
            room_id: 'room2',
            membership: 'invite'
          }
        ])
        appService.emit('ephemeral_type: m.presence', {
          content: {
            avatar_url: 'mxc://localhost/wefuiwegh8742w',
            currently_active: false,
            last_active_ago: 2478593,
            presence: 'online',
            status_msg: 'Making cupcakes'
          },
          sender: '@test:localhost',
          type: 'm.presence'
        })
        setTimeout(() => {
          expect(spyOnFetch).toHaveBeenCalledTimes(2)
          expect(spyOnFetch).toHaveBeenNthCalledWith(
            1,
            encodeURI(
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/join/room2?user_id=@test:localhost`
            ),
            expect.anything()
          )
          expect(spyOnFetch).toHaveBeenNthCalledWith(
            2,
            encodeURI(
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/join/room4?user_id=@test:localhost`
            ),
            expect.anything()
          )
          done()
        }, 3000)
      })
    })
  })
})
