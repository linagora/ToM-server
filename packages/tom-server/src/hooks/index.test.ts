import { MatrixDB } from '@twake/matrix-identity-server'
import express from 'express'
import fs from 'fs'
import type * as http from 'http'
import * as fetch from 'node-fetch'
import os from 'os'
import path from 'path'
import {
  DockerComposeEnvironment,
  Wait,
  type StartedDockerComposeEnvironment
} from 'testcontainers'
import TwakeServer from '..'
import JEST_PROCESS_ROOT_PATH from '../../jest.globals'
import { type Config } from '../types'
import buildUserDB from './__testData__/build-user-db-for-error-cases-test'
import errorCasesConfig from './__testData__/config-error-cases-test.json'
import integrationTestsConfig from './__testData__/config-integration-tests.json'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const syswideCas = require('@small-tech/syswide-cas')

const pathToTestDataFolder = path.join(
  JEST_PROCESS_ROOT_PATH,
  'src',
  'hooks',
  '__testData__'
)
const pathToSynapseDataFolder = path.join(pathToTestDataFolder, 'synapse-data')
const pathToExternalSynapseDataFolder = path.join(
  pathToTestDataFolder,
  'synapse-external'
)

jest.unmock('node-fetch')

describe('ToM Server hooks', () => {
  let twakeServer: TwakeServer
  let app: express.Application
  let expressTwakeServer: http.Server

  describe('Integration tests', () => {
    const matrixExampleServer = (integrationTestsConfig as Config).matrix_server
    const matrixExternalServer = 'matrix.external.com:446'
    let startedCompose: StartedDockerComposeEnvironment
    let tokens = {
      askywalker: '',
      lskywalker: '',
      okenobi: ''
    }
    let tokensExternal = {
      myoda: '',
      hsolo: ''
    }

    const simulationConnection = async (
      username: string,
      password: string,
      matrixServer: string
    ): Promise<string | undefined> => {
      let response = await fetch.default(
        encodeURI(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `https://${matrixServer}/_matrix/client/v3/login`
        )
      )
      let body = (await response.json()) as any
      const providerId = body.flows[0].identity_providers[0].id
      response = await fetch.default(
        encodeURI(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `https://${matrixServer}/_matrix/client/r0/login/sso/redirect/${providerId}?redirectUrl=http://localhost:9876`
        ),
        {
          redirect: 'manual'
        }
      )
      let location = (response.headers.get('location') as string).replace(
        'auth.example.com',
        'auth.example.com:446'
      )
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
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        encodeURI(`https://${matrixServer}/_matrix/client/v3/login`),
        {
          method: 'POST',
          body: JSON.stringify({
            initial_device_display_name: 'Jest Test Client',
            token: loginTokenValue,
            type: 'm.login.token'
          })
        }
      )
      body = (await response.json()) as any
      return body.access_token as string
    }

    const connectMultipleUsers = async (
      usersCredentials: Array<{ username: string; password: string }>,
      matrixServer: string
    ): Promise<string[]> => {
      const tokens: string[] = []
      for (let i = 0; i < usersCredentials.length; i++) {
        const token = await simulationConnection(
          usersCredentials[i].username,
          usersCredentials[i].password,
          matrixServer
        )
        tokens.push(token as string)
      }
      return tokens
    }

    const createRoom = async (
      token: string,
      invitations: string[] = [],
      name: string
    ): Promise<string> => {
      let requestBody = {}
      requestBody = name != null ? { ...requestBody, name } : requestBody
      requestBody =
        invitations != null
          ? { ...requestBody, invite: invitations }
          : requestBody
      const response = await fetch.default(
        encodeURI(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `https://${matrixExampleServer}/_matrix/client/v3/createRoom`
        ),
        {
          method: 'POST',
          headers: {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(requestBody)
        }
      )
      const responseBody = (await response.json()) as Record<string, string>
      return responseBody.room_id
    }

    const joinRoom = async (
      roomId: string,
      token: string,
      matrixServer: string
    ): Promise<void> => {
      await fetch.default(
        encodeURI(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `https://${matrixServer}/_matrix/client/v3/join/${roomId}`
        ),
        {
          method: 'POST',
          headers: {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            Authorization: `Bearer ${token}`
          }
        }
      )
    }

    beforeAll((done) => {
      syswideCas.addCAs(
        path.join(pathToTestDataFolder, 'nginx', 'ssl', 'ca.pem')
      )
      new DockerComposeEnvironment(
        path.join(pathToTestDataFolder),
        'docker-compose.yml'
      )
        .withEnvironment({ MYUID: os.userInfo().uid.toString() })
        .withWaitStrategy('postgresql-tom', Wait.forHealthCheck())
        .withWaitStrategy('synapse-tom', Wait.forHealthCheck())
        .withWaitStrategy('external-synapse', Wait.forHealthCheck())
        .up()
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((upResult) => {
          startedCompose = upResult
          twakeServer = new TwakeServer(integrationTestsConfig as Config)
          app = express()
          return twakeServer.ready
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          app.use(twakeServer.endpoints)
          return new Promise<void>((resolve, reject) => {
            expressTwakeServer = app.listen(3003, () => {
              resolve()
            })
          })
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return connectMultipleUsers(
            [
              { username: 'askywalker', password: 'askywalker' },
              { username: 'lskywalker', password: 'lskywalker' },
              { username: 'okenobi', password: 'okenobi' }
            ],
            matrixExampleServer
          )
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((usersTokens) => {
          if (usersTokens == null || usersTokens.some((t) => t == null)) {
            throw new Error('Error during user authentication')
          }
          const usersTokensChecked = usersTokens
          tokens = {
            askywalker: usersTokensChecked[0],
            lskywalker: usersTokensChecked[1],
            okenobi: usersTokensChecked[2]
          }
          return connectMultipleUsers(
            [
              { username: 'myoda', password: 'myoda' },
              { username: 'hsolo', password: 'hsolo' }
            ],
            matrixExternalServer
          )
        })
        .then((usersTokens) => {
          if (usersTokens == null || usersTokens.some((t) => t == null)) {
            throw new Error('Error during user authentication')
          }
          const usersTokensChecked = usersTokens
          tokensExternal = {
            myoda: usersTokensChecked[0],
            hsolo: usersTokensChecked[1]
          }
          done()
        })
        .catch((e) => {
          done(e)
        })
    })

    afterAll((done) => {
      const filesToDelete: string[] = [
        path.join(pathToSynapseDataFolder, 'matrix.example.com.signing.key'),
        path.join(pathToSynapseDataFolder, 'homeserver.log'),
        path.join(pathToSynapseDataFolder, 'media_store'),
        path.join(
          pathToExternalSynapseDataFolder,
          'matrix.external.com.signing.key'
        ),
        path.join(pathToExternalSynapseDataFolder, 'homeserver.log'),
        path.join(pathToExternalSynapseDataFolder, 'media_store')
      ]
      filesToDelete.forEach((path: string) => {
        if (fs.existsSync(path)) {
          const isDir = fs.statSync(path).isDirectory()
          isDir
            ? fs.rmSync(path, { recursive: true, force: true })
            : fs.unlinkSync(path)
        }
      })
      if (twakeServer != null) twakeServer.cleanJobs()
      if (expressTwakeServer != null) {
        expressTwakeServer.close((err) => {
          if (startedCompose != null) {
            startedCompose
              .down()
              .then(() => {
                err != null ? done(err) : done()
              })
              .catch((e) => {
                done(e)
              })
          } else if (err != null) {
            done(err)
          } else {
            done()
          }
        })
      } else {
        done()
      }
    })

    describe('Room membership event', () => {
      let spyOnLoggerInfo: jest.SpyInstance

      let roomIdOnlyLocalUsers: string
      const localUsersRoomInvitations = [
        '@lskywalker:example.com',
        '@okenobi:example.com'
      ]
      const externalUsersRoomInvitations = [
        '@myoda:external.com',
        '@hsolo:external.com'
      ]
      let roomIdWithExternalUsers: string

      beforeAll((done) => {
        spyOnLoggerInfo = jest.spyOn(twakeServer.logger, 'info')
        createRoom(
          tokens.askywalker,
          localUsersRoomInvitations,
          'room only local users'
        )
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then((roomId) => {
            roomIdOnlyLocalUsers = roomId

            return Promise.all(
              // eslint-disable-next-line @typescript-eslint/promise-function-async
              localUsersRoomInvitations.map((matrixUserId) => {
                const ldapUid = (
                  matrixUserId.match(/^@(.*):/) as RegExpMatchArray
                )[1]
                return joinRoom(
                  roomId,
                  tokens[ldapUid as keyof typeof tokens],
                  matrixExampleServer
                )
              })
            )
          })
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then((_) => {
            return createRoom(
              tokens.askywalker,
              localUsersRoomInvitations.concat(externalUsersRoomInvitations),
              'room with external users'
            )
          })
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then((roomId) => {
            roomIdWithExternalUsers = roomId
            return Promise.all(
              localUsersRoomInvitations
                // eslint-disable-next-line @typescript-eslint/promise-function-async
                .map((matrixUserId) => {
                  const ldapUid = (
                    matrixUserId.match(/^@(.*):/) as RegExpMatchArray
                  )[1]
                  return joinRoom(
                    roomId,
                    tokens[ldapUid as keyof typeof tokens],
                    matrixExampleServer
                  )
                })
                .concat(
                  // eslint-disable-next-line @typescript-eslint/promise-function-async
                  externalUsersRoomInvitations.map((matrixUserId) => {
                    const ldapUid = (
                      matrixUserId.match(/^@(.*):/) as RegExpMatchArray
                    )[1]
                    return joinRoom(
                      roomId,
                      tokensExternal[ldapUid as keyof typeof tokensExternal],
                      matrixExternalServer
                    )
                  })
                )
            )
          })
          .then((_) => {
            done()
          })
          .catch((e) => {
            done(e)
          })
      })

      it('should not remove room if it still contains local users members', async () => {
        const response = fetch.default(
          encodeURI(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `https://${matrixExampleServer}/_matrix/client/v3/rooms/${roomIdOnlyLocalUsers}/leave`
          ),
          {
            method: 'POST',
            headers: {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              Authorization: `Bearer ${tokens.lskywalker}`
            }
          }
        )
        expect((await response).status).toEqual(200)
        await new Promise<void>((resolve, _reject) => {
          setTimeout(() => {
            resolve()
          }, 3000)
        })
        const rooms = await twakeServer.matrixDb.get('rooms' as any, ['*'], {
          room_id: roomIdOnlyLocalUsers
        })
        expect(rooms.length).toEqual(1)
      })

      it('should remove room after all local users members left it', async () => {
        let rooms = await twakeServer.matrixDb.get('rooms' as any, ['*'], {
          room_id: roomIdOnlyLocalUsers
        })
        expect(rooms.length).toEqual(1)

        await Promise.all(
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          ['askywalker', 'okenobi'].map((ldapUid) =>
            fetch.default(
              encodeURI(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `https://${matrixExampleServer}/_matrix/client/v3/rooms/${roomIdOnlyLocalUsers}/leave`
              ),
              {
                method: 'POST',
                headers: {
                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  Authorization: `Bearer ${
                    tokens[ldapUid as keyof typeof tokens]
                  }`
                }
              }
            )
          )
        )
        await new Promise<void>((resolve, _reject) => {
          setTimeout(() => {
            resolve()
          }, 3000)
        })
        rooms = await twakeServer.matrixDb.get('rooms' as any, ['*'], {
          room_id: roomIdOnlyLocalUsers
        })
        expect(rooms.length).toEqual(0)
        expect(spyOnLoggerInfo).toHaveBeenCalledTimes(1)
        expect(spyOnLoggerInfo).toHaveBeenCalledWith(
          '{"kicked_users":[],"failed_to_kick_users":[],"local_aliases":[],"new_room_id":null}',
          {
            matrixUserId: '@twake:example.com',
            httpMethod: 'DELETE',
            requestUrl: `https://matrix.example.com:446/_synapse/admin/v1/rooms/${roomIdOnlyLocalUsers}`,
            status: 200
          }
        )
      })

      it('should remove room after all local users members left it even if there still are external users as members', async () => {
        let rooms = await twakeServer.matrixDb.get('rooms' as any, ['*'], {
          room_id: roomIdWithExternalUsers
        })
        expect(rooms.length).toEqual(1)

        await Promise.all(
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          ['askywalker', 'okenobi', 'lskywalker'].map((ldapUid) =>
            fetch.default(
              encodeURI(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `https://${matrixExampleServer}/_matrix/client/v3/rooms/${roomIdWithExternalUsers}/leave`
              ),
              {
                method: 'POST',
                headers: {
                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  Authorization: `Bearer ${
                    tokens[ldapUid as keyof typeof tokens]
                  }`
                }
              }
            )
          )
        )
        await new Promise<void>((resolve, _reject) => {
          setTimeout(() => {
            resolve()
          }, 3000)
        })
        rooms = await twakeServer.matrixDb.get('rooms' as any, ['*'], {
          room_id: roomIdWithExternalUsers
        })
        expect(rooms.length).toEqual(0)
        expect(spyOnLoggerInfo).toHaveBeenCalledTimes(1)
        expect(spyOnLoggerInfo).toHaveBeenCalledWith(
          '{"kicked_users":[],"failed_to_kick_users":[],"local_aliases":[],"new_room_id":null}',
          {
            matrixUserId: '@twake:example.com',
            httpMethod: 'DELETE',
            requestUrl: `https://matrix.example.com:446/_synapse/admin/v1/rooms/${roomIdWithExternalUsers}`,
            status: 200
          }
        )
      })
    })
  })

  describe('Error cases tests', () => {
    let spyOnLoggerError: jest.SpyInstance

    beforeAll((done) => {
      buildUserDB(errorCasesConfig as Config)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          done()
        })
        .catch((e) => {
          done(e)
        })
    })

    afterAll(() => {
      const filesToDelete: string[] = [
        path.join(pathToTestDataFolder, 'matrix.db'),
        path.join(pathToTestDataFolder, 'twake.db'),
        path.join(pathToTestDataFolder, 'user.db')
      ]
      filesToDelete.forEach((path: string) => {
        if (fs.existsSync(path)) {
          fs.unlinkSync(path)
        }
      })
    })

    describe('Hooks initialization', () => {
      let twakeServerDown: TwakeServer

      afterEach(() => {
        jest.restoreAllMocks()
        twakeServerDown.cleanJobs()
      })

      it('should log an error if insert application server account as homeserver admin throws an error', async () => {
        const error = new Error('Insert failed')
        jest.spyOn(MatrixDB.prototype, 'insert').mockRejectedValue(error)
        try {
          twakeServerDown = new TwakeServer(errorCasesConfig as Config)
          spyOnLoggerError = jest.spyOn(twakeServerDown.logger, 'error')
          await twakeServerDown.ready
        } catch (e) {
          expect(spyOnLoggerError).toHaveBeenCalledTimes(1)
          expect(spyOnLoggerError).toHaveBeenCalledWith(
            'Unable to initialize server',
            { error }
          )
        }
      })

      it('should log an error if insert application server account as homeserver does not return results', async () => {
        jest.spyOn(MatrixDB.prototype, 'insert').mockResolvedValue([])
        try {
          twakeServerDown = new TwakeServer(errorCasesConfig as Config)
          spyOnLoggerError = jest.spyOn(twakeServerDown.logger, 'error')
          await twakeServerDown.ready
        } catch (e) {
          expect(spyOnLoggerError).toHaveBeenCalledTimes(1)
          expect(spyOnLoggerError).toHaveBeenCalledWith(
            'Unable to initialize server',
            {
              error: new Error(
                'Set @twake:example.com as Matrix homeserver admin failed'
              )
            }
          )
        }
      })
    })

    describe('Room membership event', () => {
      beforeAll((done) => {
        twakeServer = new TwakeServer(errorCasesConfig as Config)
        spyOnLoggerError = jest.spyOn(twakeServer.logger, 'error')
        app = express()
        twakeServer.ready
          .then(() => {
            app.use(twakeServer.endpoints)
            expressTwakeServer = app.listen(3003, () => {
              done()
            })
          })
          .catch((e) => {
            done(e)
          })
      })

      afterEach(() => {
        jest.clearAllMocks()
      })

      afterAll((done) => {
        if (twakeServer != null) twakeServer.cleanJobs()
        if (expressTwakeServer != null) {
          expressTwakeServer.close((err) => {
            if (err != null) {
              done(err)
            } else {
              done()
            }
          })
        } else {
          done()
        }
      })

      it("should log an error if getting room's memberships throws an error when a member leaves the room", async () => {
        const error = new Error('Get room memberships failed')
        jest.spyOn(twakeServer.matrixDb, 'get').mockRejectedValue(error)

        twakeServer.applicationServer.emit(
          'state event | type: m.room.member',
          { content: { membership: 'leave' } }
        )
        await new Promise<void>((resolve, _reject) => {
          setTimeout(() => {
            resolve()
          }, 3000)
        })
        expect(spyOnLoggerError).toHaveBeenCalledTimes(1)
        expect(spyOnLoggerError).toHaveBeenCalledWith(error)
      })

      it('should log an error if delete empty room request throws an error', async () => {
        const error = new Error('Delete room request failed')
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockRejectedValue(error)
        twakeServer.applicationServer.emit(
          'state event | type: m.room.member',
          { content: { membership: 'leave' } }
        )
        await new Promise<void>((resolve, _reject) => {
          setTimeout(() => {
            resolve()
          }, 3000)
        })
        expect(spyOnLoggerError).toHaveBeenCalledTimes(1)
        expect(spyOnLoggerError).toHaveBeenCalledWith(error)
      })

      it('should log an error if parsing delete empty room request body throws an error', async () => {
        const error = new Error('error on parsing response body')
        jest.spyOn(twakeServer.matrixDb, 'get').mockResolvedValue([])
        jest.spyOn(fetch, 'default').mockResolvedValue({
          json: async () => {
            throw error
          },
          status: 200
        } as unknown as fetch.Response)
        twakeServer.applicationServer.emit(
          'state event | type: m.room.member',
          { content: { membership: 'leave' } }
        )
        await new Promise<void>((resolve, _reject) => {
          setTimeout(() => {
            resolve()
          }, 3000)
        })
        expect(spyOnLoggerError).toHaveBeenCalledTimes(1)
        expect(spyOnLoggerError).toHaveBeenCalledWith(error)
      })
    })
  })
})
