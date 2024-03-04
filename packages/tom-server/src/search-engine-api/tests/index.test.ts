/* eslint-disable @typescript-eslint/no-unused-vars */
import { type TwakeLogger } from '@twake/logger'
import dockerComposeV1, { v2 as dockerComposeV2 } from 'docker-compose'
import express from 'express'
import fs from 'fs'
import type * as http from 'http'
import * as fetch from 'node-fetch'
import os from 'os'
import path from 'path'
import supertest, { type Response } from 'supertest'
import {
  DockerComposeEnvironment,
  GenericContainer,
  Wait,
  type StartedDockerComposeEnvironment,
  type StartedTestContainer
} from 'testcontainers'
import TwakeServer from '../..'
import JEST_PROCESS_ROOT_PATH from '../../../jest.globals'
import { type Config } from '../../types'
import defaultConfig from '../__testData__/config.json'
import tmailData from '../__testData__/opensearch/tmail-data.json'
import tmailMapping from '../__testData__/opensearch/tmail-mapping.json'
import {
  EOpenSearchIndexingAction,
  type DocumentWithIndexingAction,
  type IOpenSearchRepository
} from '../repositories/interfaces/opensearch-repository.interface'
import { OpenSearchRepository } from '../repositories/opensearch.repository'
import { tmailMailsIndex } from '../utils/constantes'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const syswideCas = require('@small-tech/syswide-cas')

const pathToTestDataFolder = path.join(
  JEST_PROCESS_ROOT_PATH,
  'src',
  'search-engine-api',
  '__testData__'
)
const pathToSynapseDataFolder = path.join(pathToTestDataFolder, 'synapse-data')

jest.unmock('node-fetch')

describe('Search engine API - Integration tests', () => {
  const matrixServer = defaultConfig.matrix_server
  let openSearchContainer: GenericContainer
  let openSearchStartedContainer: StartedTestContainer
  let containerNameSuffix: string
  let startedCompose: StartedDockerComposeEnvironment
  let tokens: Record<string, string> = {
    askywalker: '',
    lskywalker: '',
    okenobi: '',
    chewbacca: ''
  }

  let twakeServer: TwakeServer
  let app: express.Application
  let expressTwakeServer: http.Server
  let openSearchRepository: IOpenSearchRepository
  const {
    opensearch_ca_cert_path: osCaCertPath,
    opensearch_host: osHost,
    opensearch_password: osPwd,
    opensearch_user: osUser,
    ...testConfig
  } = { ...defaultConfig, rate_limiting_window: 600000 }
  process.env.OPENSEARCH_CA_CERT_PATH = osCaCertPath
  process.env.OPENSEARCH_HOST = osHost
  process.env.OPENSEARCH_PASSWORD = osPwd
  process.env.OPENSEARCH_USER = osUser

  const addIndexedMailsInOpenSearch = async (
    conf: Config,
    logger: TwakeLogger
  ): Promise<void> => {
    openSearchRepository = new OpenSearchRepository(conf, logger)
    await openSearchRepository.createIndex(
      tmailMailsIndex,
      tmailMapping.mailbox_v2.mappings
    )
    await openSearchRepository.indexDocuments({
      [tmailMailsIndex]: tmailData.map((data) => ({
        ...data._source,
        action: EOpenSearchIndexingAction.CREATE,
        id: data._source.messageId
      })) as unknown as DocumentWithIndexingAction[]
    })
  }

  const simulationConnection = async (
    username: string,
    password: string
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
      'auth.example.com:445'
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
    location = (response.headers.get('location') as string).replace(
      'matrix.example.com',
      'matrix.example.com:445'
    )
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
    usersCredentials: Array<{ username: string; password: string }>
  ): Promise<string[]> => {
    const tokens: string[] = []
    for (let i = 0; i < usersCredentials.length; i++) {
      const token = await simulationConnection(
        usersCredentials[i].username,
        usersCredentials[i].password
      )
      tokens.push(token as string)
    }
    return tokens
  }

  const createRoom = async (
    token: string,
    invitations: string[] = [],
    name?: string,
    isDirect?: boolean,
    initialState?: Array<Record<string, any>>
  ): Promise<string> => {
    if ((isDirect == null || !isDirect) && name == null) {
      throw Error('Name must be defined for an undirect room')
    }
    let requestBody = {}
    requestBody = name != null ? { ...requestBody, name } : requestBody
    requestBody =
      isDirect != null ? { ...requestBody, is_direct: isDirect } : requestBody
    requestBody =
      invitations != null
        ? { ...requestBody, invite: invitations }
        : requestBody
    requestBody =
      initialState != null
        ? { ...requestBody, initial_state: initialState }
        : requestBody

    const response = await fetch.default(
      encodeURI(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `https://${matrixServer}/_matrix/client/v3/createRoom`
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

  const joinRoom = async (roomId: string, token: string): Promise<void> => {
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

  const addAvatar = async (userId: string, token: string): Promise<void> => {
    await fetch.default(
      encodeURI(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `https://${matrixServer}/_matrix/client/v3/profile/${userId}/avatar_url`
      ),
      {
        method: 'PUT',
        headers: {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34'
        })
      }
    )
  }

  interface IFileInfo {
    h: number
    mimetype: string
    size: number
    w: number
    'xyz.amorgan.blurhash': string
  }

  interface IFile extends IFileInfo {
    thumbnail_url?: string
    thumbnail_info: IFileInfo
  }

  interface IMessage {
    body: string
    filename?: string
    msgtype: string
    url?: string
    info?: IFile
  }

  const sendMessage = async (
    token: string,
    roomId: string,
    message: IMessage,
    filePath?: string
  ): Promise<Record<string, string>> => {
    if (message.msgtype === 'm.image') {
      const file = fs.readFileSync(filePath as string)
      await fetch.default(
        encodeURI(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `https://${matrixServer}/_matrix/media/v3/upload?filename=${message.filename}`
        ),
        {
          method: 'POST',
          headers: {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            Authorization: `Bearer ${token}`,
            'content-type': 'image/jpeg'
          },
          body: Buffer.from(file).toString('base64')
        }
      )
    }

    const response = await fetch.default(
      encodeURI(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `https://${matrixServer}/_matrix/client/v3/rooms/${roomId}/send/m.room.message/${Math.random()}`
      ),
      {
        method: 'PUT',
        headers: {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(message)
      }
    )
    const body = (await response.json()) as Record<string, string>
    return body
  }

  beforeAll((done) => {
    syswideCas.addCAs(path.join(pathToTestDataFolder, 'nginx', 'ssl', 'ca.pem'))
    Promise.allSettled([dockerComposeV1.version(), dockerComposeV2.version()])
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((results) => {
        const promiseSucceededIndex = results.findIndex(
          (res) => res.status === 'fulfilled'
        )
        if (promiseSucceededIndex === -1) {
          throw new Error('Docker compose is not installed')
        }
        containerNameSuffix = promiseSucceededIndex === 0 ? '_' : '-'
        return new DockerComposeEnvironment(
          path.join(pathToTestDataFolder),
          'docker-compose.yml'
        )
          .withEnvironment({ MYUID: os.userInfo().uid.toString() })
          .withWaitStrategy(
            `postgresql${containerNameSuffix}1`,
            Wait.forHealthCheck()
          )
          .withWaitStrategy(
            `synapse${containerNameSuffix}1`,
            Wait.forHealthCheck()
          )
          .up()
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((upResult) => {
        startedCompose = upResult

        openSearchContainer = new GenericContainer(
          'opensearchproject/opensearch'
        )
          .withHealthCheck({
            test: [
              'CMD',
              'curl',
              'http://localhost:9200',
              '-ku',
              "'admin:admin'"
            ],
            interval: 10000,
            timeout: 10000,
            retries: 3
          })
          .withNetworkMode(
            startedCompose
              .getContainer(`nginx-proxy${containerNameSuffix}1`)
              .getNetworkNames()[0]
          )
          .withEnvironment({
            'discovery.type': 'single-node',
            DISABLE_INSTALL_DEMO_CONFIG: 'true',
            DISABLE_SECURITY_PLUGIN: 'true',
            VIRTUAL_PORT: '9200',
            VIRTUAL_HOST: 'opensearch.example.com'
          })
          .withWaitStrategy(Wait.forHealthCheck())

        return openSearchContainer.start()
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((startedContainer) => {
        openSearchStartedContainer = startedContainer
        return startedCompose
          .getContainer(`nginx-proxy${containerNameSuffix}1`)
          .restart()
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        twakeServer = new TwakeServer(testConfig as Config)
        app = express()
        return twakeServer.ready
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        app.use(twakeServer.endpoints)
        return new Promise<void>((resolve, reject) => {
          expressTwakeServer = app.listen(3002, () => {
            resolve()
          })
        })
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        return addIndexedMailsInOpenSearch(twakeServer.conf, twakeServer.logger)
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        return connectMultipleUsers([
          { username: 'askywalker', password: 'askywalker' },
          { username: 'lskywalker', password: 'lskywalker' },
          { username: 'okenobi', password: 'okenobi' },
          { username: 'chewbacca', password: 'chewbacca' }
        ])
      })
      .then((usersTokens) => {
        if (usersTokens == null || usersTokens.some((t) => t == null)) {
          throw new Error('Error during user authentication')
        }
        const usersTokensChecked = usersTokens
        tokens = {
          askywalker: usersTokensChecked[0],
          lskywalker: usersTokensChecked[1],
          okenobi: usersTokensChecked[2],
          chewbacca: usersTokensChecked[3]
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
      path.join(pathToSynapseDataFolder, 'media_store')
    ]
    filesToDelete.forEach((path: string) => {
      if (fs.existsSync(path)) {
        const isDir = fs.statSync(path).isDirectory()
        isDir
          ? fs.rmSync(path, { recursive: true, force: true })
          : fs.unlinkSync(path)
      }
    })
    if (openSearchRepository != null) openSearchRepository.close()
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

  let roomGroupId1: string
  let roomGroupId2: string
  let roomGroupId3: string
  let roomGroupId4: string
  let roomIdDirect: string
  let roomIdEncrypted: string

  it('should find rooms matching search', async () => {
    await addAvatar('@lskywalker:example.com', tokens.lskywalker)
    roomGroupId1 = await createRoom(
      tokens.askywalker,
      ['@lskywalker:example.com', '@okenobi:example.com'],
      'test skywalkers room',
      false,
      [
        {
          content: { url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR' },
          state_key: '',
          type: 'm.room.avatar'
        }
      ]
    )
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      ['lskywalker', 'okenobi'].map<Promise<void>>((uid) =>
        joinRoom(roomGroupId1, tokens[uid])
      )
    )

    roomGroupId2 = await createRoom(
      tokens.okenobi,
      ['@askywalker:example.com', '@lskywalker:example.com'],
      'test okenobi room'
    )
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      ['askywalker', 'lskywalker'].map<Promise<void>>((uid) =>
        joinRoom(roomGroupId2, tokens[uid])
      )
    )

    roomGroupId3 = await createRoom(
      tokens.okenobi,
      ['@lskywalker:example.com'],
      'test skywalkers room without Anakin'
    )
    await joinRoom(roomGroupId3, tokens.lskywalker)

    roomGroupId4 = await createRoom(
      tokens.askywalker,
      ['@lskywalker:example.com'],
      'test skywalkers room without avatar'
    )
    await joinRoom(roomGroupId4, tokens.lskywalker)

    roomIdDirect = await createRoom(
      tokens.lskywalker,
      ['@askywalker:example.com'],
      undefined,
      true
    )
    await joinRoom(roomIdDirect, tokens.askywalker)

    roomIdEncrypted = await createRoom(
      tokens.askywalker,
      ['@lskywalker:example.com', '@okenobi:example.com'],
      'test encrypted skywalkers room',
      false,
      [
        {
          content: { algorithm: 'm.megolm.v1.aes-sha2' },
          type: 'm.room.encryption'
        }
      ]
    )
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      ['lskywalker', 'okenobi'].map<Promise<void>>((uid) =>
        joinRoom(roomIdEncrypted, tokens[uid])
      )
    )

    const response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.askywalker}`)
      .send({
        searchValue: 'sky'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(2)
    expect(response.body.messages).toHaveLength(0)
    expect(response.body.mails).toHaveLength(0)
    expect(response.body.rooms).toEqual(
      expect.arrayContaining([
        {
          room_id: roomGroupId1,
          name: 'test skywalkers room',
          avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR'
        },
        {
          room_id: roomGroupId4,
          name: 'test skywalkers room without avatar',
          avatar_url: null
        }
      ])
    )
  })

  let msg1EventId: string
  let msg2EventId: string
  let msg3EventId: string
  let msg4EventId: string
  let msg5EventId: string
  let msg6EventId: string
  let msg7EventId: string
  let msg8EventId: string
  let msg9EventId: string
  let msg10EventId: string
  let msg11EventId: string
  let msg12EventId: string
  let msg13EventId: string
  let msg14EventId: string
  let msg15EventId: string

  it('should find messages matching search', async () => {
    msg1EventId = (
      await sendMessage(tokens.askywalker, roomGroupId1, {
        body: 'Hello members',
        msgtype: 'm.text'
      })
    ).event_id
    msg2EventId = (
      await sendMessage(tokens.lskywalker, roomGroupId1, {
        body: 'Hello others',
        msgtype: 'm.text'
      })
    ).event_id
    msg3EventId = (
      await sendMessage(tokens.okenobi, roomGroupId1, {
        body: 'Hello Anakin Skywalker',
        msgtype: 'm.text'
      })
    ).event_id

    msg4EventId = (
      await sendMessage(tokens.lskywalker, roomIdDirect, {
        body: 'Hello Anakin this is Luke, it is a direct message',
        msgtype: 'm.text'
      })
    ).event_id
    msg5EventId = (
      await sendMessage(tokens.askywalker, roomIdDirect, {
        body: 'Hey Luke',
        msgtype: 'm.text'
      })
    ).event_id
    msg6EventId = (
      await sendMessage(tokens.lskywalker, roomIdDirect, {
        body: 'How are you dad?',
        msgtype: 'm.text'
      })
    ).event_id

    msg7EventId = (
      await sendMessage(tokens.okenobi, roomGroupId2, {
        body: 'Hello this is Obi-Wan, admin of this room',
        msgtype: 'm.text'
      })
    ).event_id
    msg8EventId = (
      await sendMessage(tokens.askywalker, roomGroupId2, {
        body: 'Hello master, I will be late',
        msgtype: 'm.text'
      })
    ).event_id
    msg9EventId = (
      await sendMessage(tokens.lskywalker, roomGroupId2, {
        body: 'Hye this is Luke',
        msgtype: 'm.text'
      })
    ).event_id

    msg10EventId = (
      await sendMessage(tokens.okenobi, roomGroupId3, {
        body: 'Hello this is Obi-Wan, Anakin is not a member of this room',
        msgtype: 'm.text'
      })
    ).event_id
    msg11EventId = (
      await sendMessage(tokens.lskywalker, roomGroupId3, {
        body: 'Hello Obi-Wan, we should invite him',
        msgtype: 'm.text'
      })
    ).event_id

    msg12EventId = (
      await sendMessage(tokens.lskywalker, roomGroupId4, {
        body: 'Hello this is Luke, anakin is a member of this room',
        msgtype: 'm.text'
      })
    ).event_id
    msg13EventId = (
      await sendMessage(tokens.lskywalker, roomGroupId4, {
        body: 'But this room does not have avatar',
        msgtype: 'm.text'
      })
    ).event_id

    msg14EventId = (
      await sendMessage(
        tokens.askywalker,
        roomGroupId1,
        {
          body: 'anakin-at-the-office.jpg',
          msgtype: 'm.image',
          filename: 'anakin-at-the-office.jpg'
        },
        path.join(pathToTestDataFolder, 'images', 'anakin-at-the-office.jpg')
      )
    ).event_id
    msg15EventId = (
      await sendMessage(tokens.askywalker, roomIdEncrypted, {
        body: 'Hey this is Anakin, we are in an encrypted room',
        msgtype: 'm.text'
      })
    ).event_id
    await new Promise<void>((resolve, _reject) => {
      setTimeout(() => {
        resolve()
      }, 3000)
    })

    const response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.askywalker}`)
      .send({
        searchValue: 'anak'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(0)
    expect(response.body.messages).toHaveLength(7)
    expect(response.body.mails).toHaveLength(0)
    expect(response.body.messages).toEqual(
      expect.arrayContaining([
        {
          room_id: roomGroupId1,
          event_id: msg1EventId,
          content: 'Hello members',
          display_name: 'Anakin Skywalker',
          avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
          room_name: 'test skywalkers room'
        },
        {
          room_id: roomGroupId1,
          event_id: msg3EventId,
          content: 'Hello Anakin Skywalker',
          display_name: 'Obi-Wan Kenobi',
          avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
          room_name: 'test skywalkers room'
        },
        {
          room_id: roomIdDirect,
          event_id: msg4EventId,
          content: 'Hello Anakin this is Luke, it is a direct message',
          display_name: 'Luke Skywalker',
          avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
          room_name: null
        },
        {
          room_id: roomIdDirect,
          event_id: msg5EventId,
          content: 'Hey Luke',
          display_name: 'Anakin Skywalker',
          avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
          room_name: null
        },
        {
          room_id: roomGroupId2,
          event_id: msg8EventId,
          content: 'Hello master, I will be late',
          display_name: 'Anakin Skywalker',
          avatar_url: null,
          room_name: 'test okenobi room'
        },
        {
          room_id: roomGroupId4,
          event_id: msg12EventId,
          content: 'Hello this is Luke, anakin is a member of this room',
          display_name: 'Luke Skywalker',
          avatar_url: null,
          room_name: 'test skywalkers room without avatar'
        },
        {
          room_id: roomGroupId1,
          event_id: msg14EventId,
          content: 'anakin-at-the-office.jpg',
          display_name: 'Anakin Skywalker',
          avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
          room_name: 'test skywalkers room'
        }
      ])
    )
  })

  it('should find mails matching search', async () => {
    const response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.lskywalker}`)
      .send({
        searchValue: 'ay'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(0)
    expect(response.body.messages).toHaveLength(0)
    expect(response.body.mails).toHaveLength(3)
    expect(response.body.mails).toEqual(
      expect.arrayContaining([
        {
          ...tmailData[0]._source,
          id: tmailData[0]._source.messageId
        },
        {
          ...tmailData[3]._source,
          id: tmailData[3]._source.messageId
        },
        {
          ...tmailData[4]._source,
          id: tmailData[4]._source.messageId
        }
      ])
    )
  })

  let expectedRooms: Array<{
    room_id: string
    name: string
    avatar_url: string | null
  }>

  let expectedMessages: Array<{
    room_id: string
    event_id: string
    content: string
    display_name: string | null
    avatar_url: string | null
    room_name: string | null
  }>

  const expectedMails = [
    {
      ...tmailData[0]._source,
      id: tmailData[0]._source.messageId
    },
    {
      ...tmailData[1]._source,
      id: tmailData[1]._source.messageId
    },
    {
      ...tmailData[3]._source,
      id: tmailData[3]._source.messageId
    },
    {
      ...tmailData[4]._source,
      id: tmailData[4]._source.messageId
    }
  ]
  it('should find rooms, messages and mails matching search', async () => {
    expectedRooms = [
      {
        room_id: roomGroupId1,
        name: 'test skywalkers room',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR'
      },
      {
        room_id: roomGroupId4,
        name: 'test skywalkers room without avatar',
        avatar_url: null
      },
      {
        room_id: roomGroupId3,
        name: 'test skywalkers room without Anakin',
        avatar_url: null
      }
    ]

    expectedMessages = [
      {
        room_id: roomGroupId1,
        event_id: msg1EventId,
        content: 'Hello members',
        display_name: 'Anakin Skywalker',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
        room_name: 'test skywalkers room'
      },
      {
        room_id: roomGroupId1,
        event_id: msg2EventId,
        content: 'Hello others',
        display_name: 'Luke Skywalker',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
        room_name: 'test skywalkers room'
      },
      {
        room_id: roomGroupId1,
        event_id: msg3EventId,
        content: 'Hello Anakin Skywalker',
        display_name: 'Obi-Wan Kenobi',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
        room_name: 'test skywalkers room'
      },
      {
        room_id: roomIdDirect,
        event_id: msg4EventId,
        content: 'Hello Anakin this is Luke, it is a direct message',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomIdDirect,
        event_id: msg5EventId,
        content: 'Hey Luke',
        display_name: 'Anakin Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomIdDirect,
        event_id: msg6EventId,
        content: 'How are you dad?',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomGroupId2,
        event_id: msg8EventId,
        content: 'Hello master, I will be late',
        display_name: 'Anakin Skywalker',
        avatar_url: null,
        room_name: 'test okenobi room'
      },
      {
        room_id: roomGroupId2,
        event_id: msg9EventId,
        content: 'Hye this is Luke',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test okenobi room'
      },
      {
        room_id: roomGroupId3,
        event_id: msg11EventId,
        content: 'Hello Obi-Wan, we should invite him',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without Anakin'
      },
      {
        room_id: roomGroupId4,
        event_id: msg12EventId,
        content: 'Hello this is Luke, anakin is a member of this room',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without avatar'
      },
      {
        room_id: roomGroupId4,
        event_id: msg13EventId,
        content: 'But this room does not have avatar',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without avatar'
      },
      {
        room_id: roomGroupId1,
        event_id: msg14EventId,
        content: 'anakin-at-the-office.jpg',
        display_name: 'Anakin Skywalker',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
        room_name: 'test skywalkers room'
      }
    ]

    const response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.lskywalker}`)
      .send({
        searchValue: 'skywalker'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(3)
    expect(response.body.messages).toHaveLength(12)
    expect(response.body.mails).toHaveLength(4)
    expect(response.body.rooms).toEqual(expect.arrayContaining(expectedRooms))
    expect(response.body.messages).toEqual(
      expect.arrayContaining(expectedMessages)
    )
    expect(response.body.mails).toEqual(expect.arrayContaining(expectedMails))
  })

  it('should find rooms, messages and mails matching search after opensearch container and ToM server restart', async () => {
    if (openSearchRepository != null) openSearchRepository.close()
    if (twakeServer != null) twakeServer.cleanJobs()
    await new Promise<void>((resolve, reject) => {
      expressTwakeServer.close((err) => {
        if (err != null) {
          reject(err)
        }
        resolve()
      })
    })

    await openSearchStartedContainer.stop()
    await openSearchContainer.start()

    console.info('Server closed. Restarting.')

    await startedCompose
      .getContainer(`nginx-proxy${containerNameSuffix}1`)
      .restart()

    twakeServer = new TwakeServer(testConfig as Config)
    app = express()
    await twakeServer.ready
    app.use(twakeServer.endpoints)
    await new Promise<void>((resolve, reject) => {
      expressTwakeServer = app.listen(3002, () => {
        resolve()
      })
    })
    await addIndexedMailsInOpenSearch(twakeServer.conf, twakeServer.logger)
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, 3000)
    })
    console.info('Server is listening to port 3002.')

    const response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.lskywalker}`)
      .send({
        searchValue: 'skywalker'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(3)
    expect(response.body.messages).toHaveLength(12)
    expect(response.body.mails).toHaveLength(4)
    expect(response.body.rooms).toEqual(expect.arrayContaining(expectedRooms))
    expect(response.body.messages).toEqual(
      expect.arrayContaining(expectedMessages)
    )
    expect(response.body.mails).toEqual(expect.arrayContaining(expectedMails))
  })

  it('should find rooms, messages and mails matching search after manual restore', async () => {
    let response = await supertest(app).post(
      '/_twake/app/v1/opensearch/restore'
    )
    expect(response.statusCode).toBe(204)
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, 3000)
    })

    response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.lskywalker}`)
      .send({
        searchValue: 'skywalker'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(3)
    expect(response.body.messages).toHaveLength(12)
    expect(response.body.mails).toHaveLength(4)
    expect(response.body.rooms).toEqual(expect.arrayContaining(expectedRooms))
    expect(response.body.messages).toEqual(
      expect.arrayContaining(expectedMessages)
    )
    expect(response.body.mails).toEqual(expect.arrayContaining(expectedMails))
  })

  it('should find rooms matching search after update room name', async () => {
    await fetch.default(
      encodeURI(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `https://${matrixServer}/_matrix/client/v3/rooms/${roomGroupId1}/state/m.room.name/`
      ),
      {
        method: 'PUT',
        headers: {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${tokens.askywalker}`
        },
        body: JSON.stringify({ name: 'Skywalkers room updated' })
      }
    )
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, 3000)
    })

    expectedRooms = [
      {
        room_id: roomGroupId1,
        name: 'Skywalkers room updated',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR'
      },
      {
        room_id: roomGroupId4,
        name: 'test skywalkers room without avatar',
        avatar_url: null
      },
      {
        room_id: roomGroupId3,
        name: 'test skywalkers room without Anakin',
        avatar_url: null
      }
    ]

    expectedMessages = [
      {
        room_id: roomGroupId1,
        event_id: msg1EventId,
        content: 'Hello members',
        display_name: 'Anakin Skywalker',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
        room_name: 'Skywalkers room updated'
      },
      {
        room_id: roomGroupId1,
        event_id: msg2EventId,
        content: 'Hello others',
        display_name: 'Luke Skywalker',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
        room_name: 'Skywalkers room updated'
      },
      {
        room_id: roomGroupId1,
        event_id: msg3EventId,
        content: 'Hello Anakin Skywalker',
        display_name: 'Obi-Wan Kenobi',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
        room_name: 'Skywalkers room updated'
      },
      {
        room_id: roomIdDirect,
        event_id: msg4EventId,
        content: 'Hello Anakin this is Luke, it is a direct message',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomIdDirect,
        event_id: msg5EventId,
        content: 'Hey Luke',
        display_name: 'Anakin Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomIdDirect,
        event_id: msg6EventId,
        content: 'How are you dad?',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomGroupId2,
        event_id: msg8EventId,
        content: 'Hello master, I will be late',
        display_name: 'Anakin Skywalker',
        avatar_url: null,
        room_name: 'test okenobi room'
      },
      {
        room_id: roomGroupId2,
        event_id: msg9EventId,
        content: 'Hye this is Luke',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test okenobi room'
      },
      {
        room_id: roomGroupId3,
        event_id: msg11EventId,
        content: 'Hello Obi-Wan, we should invite him',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without Anakin'
      },
      {
        room_id: roomGroupId4,
        event_id: msg12EventId,
        content: 'Hello this is Luke, anakin is a member of this room',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without avatar'
      },
      {
        room_id: roomGroupId4,
        event_id: msg13EventId,
        content: 'But this room does not have avatar',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without avatar'
      },
      {
        room_id: roomGroupId1,
        event_id: msg14EventId,
        content: 'anakin-at-the-office.jpg',
        display_name: 'Anakin Skywalker',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
        room_name: 'Skywalkers room updated'
      }
    ]

    const response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.lskywalker}`)
      .send({
        searchValue: 'skywalker'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(3)
    expect(response.body.messages).toHaveLength(12)
    expect(response.body.mails).toHaveLength(4)
    expect(response.body.rooms).toEqual(expect.arrayContaining(expectedRooms))
    expect(response.body.messages).toEqual(
      expect.arrayContaining(expectedMessages)
    )
    expect(response.body.mails).toEqual(expect.arrayContaining(expectedMails))
  })

  it('should find messages matching search after display name update', async () => {
    await fetch.default(
      encodeURI(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `https://${matrixServer}/_matrix/client/v3/profile/@askywalker:example.com/displayname`
      ),
      {
        method: 'PUT',
        headers: {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${tokens.askywalker}`
        },
        body: JSON.stringify({ displayname: 'Dark Vador' })
      }
    )
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, 3000)
    })

    expectedMessages = [
      {
        room_id: roomGroupId1,
        event_id: msg2EventId,
        content: 'Hello others',
        display_name: 'Luke Skywalker',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
        room_name: 'Skywalkers room updated'
      },
      {
        room_id: roomGroupId1,
        event_id: msg3EventId,
        content: 'Hello Anakin Skywalker',
        display_name: 'Obi-Wan Kenobi',
        avatar_url: 'mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR',
        room_name: 'Skywalkers room updated'
      },
      {
        room_id: roomIdDirect,
        event_id: msg4EventId,
        content: 'Hello Anakin this is Luke, it is a direct message',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomIdDirect,
        event_id: msg6EventId,
        content: 'How are you dad?',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomGroupId2,
        event_id: msg9EventId,
        content: 'Hye this is Luke',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test okenobi room'
      },
      {
        room_id: roomGroupId3,
        event_id: msg11EventId,
        content: 'Hello Obi-Wan, we should invite him',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without Anakin'
      },
      {
        room_id: roomGroupId4,
        event_id: msg12EventId,
        content: 'Hello this is Luke, anakin is a member of this room',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without avatar'
      },
      {
        room_id: roomGroupId4,
        event_id: msg13EventId,
        content: 'But this room does not have avatar',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without avatar'
      }
    ]

    const response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.lskywalker}`)
      .send({
        searchValue: 'skywalker'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(3)
    expect(response.body.messages).toHaveLength(8)
    expect(response.body.mails).toHaveLength(4)
    expect(response.body.rooms).toEqual(expect.arrayContaining(expectedRooms))
    expect(response.body.messages).toEqual(
      expect.arrayContaining(expectedMessages)
    )
    expect(response.body.mails).toEqual(expect.arrayContaining(expectedMails))
  })

  it("should remove room and room's messages from results after room encryption", async () => {
    await fetch.default(
      encodeURI(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `https://${matrixServer}/_matrix/client/v3/rooms/${roomGroupId1}/state/m.room.encryption`
      ),
      {
        method: 'PUT',
        headers: {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${tokens.askywalker}`
        },
        body: JSON.stringify({ algorithm: 'm.megolm.v1.aes-sha2' })
      }
    )
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, 3000)
    })

    expectedRooms = [
      {
        room_id: roomGroupId4,
        name: 'test skywalkers room without avatar',
        avatar_url: null
      },
      {
        room_id: roomGroupId3,
        name: 'test skywalkers room without Anakin',
        avatar_url: null
      }
    ]

    expectedMessages = [
      {
        room_id: roomIdDirect,
        event_id: msg4EventId,
        content: 'Hello Anakin this is Luke, it is a direct message',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomIdDirect,
        event_id: msg6EventId,
        content: 'How are you dad?',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomGroupId2,
        event_id: msg9EventId,
        content: 'Hye this is Luke',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test okenobi room'
      },
      {
        room_id: roomGroupId3,
        event_id: msg11EventId,
        content: 'Hello Obi-Wan, we should invite him',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without Anakin'
      },
      {
        room_id: roomGroupId4,
        event_id: msg12EventId,
        content: 'Hello this is Luke, anakin is a member of this room',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without avatar'
      },
      {
        room_id: roomGroupId4,
        event_id: msg13EventId,
        content: 'But this room does not have avatar',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without avatar'
      }
    ]

    const response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.lskywalker}`)
      .send({
        searchValue: 'skywalker'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(2)
    expect(response.body.messages).toHaveLength(6)
    expect(response.body.mails).toHaveLength(4)
    expect(response.body.rooms).toEqual(expect.arrayContaining(expectedRooms))
    expect(response.body.messages).toEqual(
      expect.arrayContaining(expectedMessages)
    )
    expect(response.body.mails).toEqual(expect.arrayContaining(expectedMails))
  })

  it('should remove message from results after deleting message', async () => {
    await fetch.default(
      encodeURI(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `https://${matrixServer}/_matrix/client/v3/rooms/${roomGroupId4}/redact/${msg12EventId}/123`
      ),
      {
        method: 'PUT',
        headers: {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${tokens.lskywalker}`
        },
        body: JSON.stringify({ reason: 'Message content is invalid' })
      }
    )
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, 3000)
    })

    expectedMessages = [
      {
        room_id: roomIdDirect,
        event_id: msg4EventId,
        content: 'Hello Anakin this is Luke, it is a direct message',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomIdDirect,
        event_id: msg6EventId,
        content: 'How are you dad?',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: null
      },
      {
        room_id: roomGroupId2,
        event_id: msg9EventId,
        content: 'Hye this is Luke',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test okenobi room'
      },
      {
        room_id: roomGroupId3,
        event_id: msg11EventId,
        content: 'Hello Obi-Wan, we should invite him',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without Anakin'
      },
      {
        room_id: roomGroupId4,
        event_id: msg13EventId,
        content: 'But this room does not have avatar',
        display_name: 'Luke Skywalker',
        avatar_url: null,
        room_name: 'test skywalkers room without avatar'
      }
    ]

    const response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.lskywalker}`)
      .send({
        searchValue: 'skywalker'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(2)
    expect(response.body.messages).toHaveLength(5)
    expect(response.body.mails).toHaveLength(4)
    expect(response.body.rooms).toEqual(expect.arrayContaining(expectedRooms))
    expect(response.body.messages).toEqual(
      expect.arrayContaining(expectedMessages)
    )
    expect(response.body.mails).toEqual(expect.arrayContaining(expectedMails))
  })

  it('results should contain message with correct content after updating message content', async () => {
    await fetch.default(
      encodeURI(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `https://${matrixServer}/_matrix/client/v3/rooms/${roomGroupId4}/send/m.room.message/124`
      ),
      {
        method: 'PUT',
        headers: {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${tokens.lskywalker}`
        },
        body: JSON.stringify({
          msgtype: 'm.text',
          body: ' * But this room does not have avatar unless you add one',
          'm.new_content': {
            msgtype: 'm.text',
            body: 'But this room does not have avatar unless you add one',
            'm.mentions': {}
          },
          'm.mentions': {},
          'm.relates_to': {
            rel_type: 'm.replace',
            event_id: msg13EventId
          }
        })
      }
    )
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, 3000)
    })

    expectedMessages[expectedMessages.length - 1] = {
      room_id: roomGroupId4,
      event_id: msg13EventId,
      content: 'But this room does not have avatar unless you add one',
      display_name: 'Luke Skywalker',
      avatar_url: null,
      room_name: 'test skywalkers room without avatar'
    }

    const response = await supertest(app)
      .post('/_twake/app/v1/search')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${tokens.lskywalker}`)
      .send({
        searchValue: 'skywalker'
      })
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(2)
    expect(response.body.messages).toHaveLength(5)
    expect(response.body.mails).toHaveLength(4)
    expect(response.body.rooms).toEqual(expect.arrayContaining(expectedRooms))
    expect(response.body.messages).toEqual(
      expect.arrayContaining(expectedMessages)
    )
    expect(response.body.mails).toEqual(expect.arrayContaining(expectedMails))
  })

  it('should reject if more than 100 requests are done in less than 10 seconds', async () => {
    let response
    let token
    // eslint-disable-next-line @typescript-eslint/no-for-in-array, @typescript-eslint/no-unused-vars
    for (const i in [...Array(101).keys()]) {
      token =
        Number(i) % 2 === 0 ? `Bearer ${tokens.lskywalker}` : 'falsy_token'
      response = await supertest(app)
        .post('/_twake/app/v1/search')
        .set('Accept', 'application/json')
        .set('Authorization', token)
        .send({
          searchValue: 'skywalker'
        })
    }
    expect((response as Response).statusCode).toEqual(429)
    await new Promise((resolve) => setTimeout(resolve, 11000))
  })
})
