import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../index'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import { type Config } from '../types'
import defaultConfig from '../__testData__/registerConfRoom.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { randomString } from '@twake/crypto'

process.env.TWAKE_CLIENT_SERVER_CONF =
  './src/__testData__/registerConfRoom.json'
jest.mock('node-fetch', () => jest.fn())

let conf: Config
let clientServer: ClientServer
let app: express.Application

const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  // @ts-expect-error TS doesn't understand that the config is valid
  conf = {
    ...defaultConfig,
    cron_service: false,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    matrix_database_engine: 'sqlite'
  }
  if (process.env.TEST_PG === 'yes') {
    conf.database_engine = 'pg'
    conf.userdb_engine = 'pg'
    conf.database_host = process.env.PG_HOST ?? 'localhost'
    conf.database_user = process.env.PG_USER ?? 'twake'
    conf.database_password = process.env.PG_PASSWORD ?? 'twake'
    conf.database_name = process.env.PG_DATABASE ?? 'test'
  }
  buildUserDB(conf)
    .then(() => {
      buildMatrixDb(conf)
        .then(() => {
          done()
        })
        .catch((e) => {
          logger.error('Error while building matrix db:', e)
          done(e)
        })
    })
    .catch((e) => {
      logger.error('Error while building user db:', e)
      done(e)
    })
})

afterAll(() => {
  fs.unlinkSync('src/__testData__/testRoom.db')
  fs.unlinkSync('src/__testData__/testMatrixRoom.db')
})

describe('Use configuration file', () => {
  beforeAll((done) => {
    clientServer = new ClientServer()
    app = express()
    clientServer.ready
      .then(() => {
        Object.keys(clientServer.api.get).forEach((k) => {
          app.get(k, clientServer.api.get[k])
        })
        Object.keys(clientServer.api.post).forEach((k) => {
          app.post(k, clientServer.api.post[k])
        })
        Object.keys(clientServer.api.put).forEach((k) => {
          app.put(k, clientServer.api.put[k])
        })
        Object.keys(clientServer.api.delete).forEach((k) => {
          app.delete(k, clientServer.api.delete[k])
        })
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  afterAll(() => {
    clientServer.cleanJobs()
  })

  let validToken: string
  let validToken2: string
  let validToken3: string
  describe('Endpoints with authentication', () => {
    beforeAll(async () => {
      validToken = randomString(64)
      validToken2 = randomString(64)
      validToken3 = randomString(64)
      try {
        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser:example.com',
          device_id: 'testdevice',
          access_token: validToken,
          ip: '127.0.0.1',
          user_agent: 'curl/7.31.0-DEV',
          last_seen: 1411996332123
        })

        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser2:example.com',
          device_id: 'testdevice2',
          access_token: validToken2,
          ip: '137.0.0.1',
          user_agent: 'curl/7.31.0-DEV',
          last_seen: 1411996332123
        })

        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser3:example.com',
          device_id: 'testdevice3',
          access_token: validToken3,
          ip: '147.0.0.1',
          user_agent: 'curl/7.31.0-DEV',
          last_seen: 1411996332123
        })
      } catch (e) {
        logger.error('Error creating tokens for authentification', e)
      }
    })
    describe('/_matrix/client/v3/rooms', () => {
      describe('/_matrix/client/v3/rooms/:roomId', () => {
        describe('/_matrix/client/v3/rooms/:roomId/event/:eventId', () => {
          beforeAll(async () => {
            try {
              await clientServer.matrixDb.insert('events', {
                event_id: 'event_to_retrieve',
                room_id: '!testroom:example.com',
                sender: '@sender:example.com',
                type: 'm.room.message',
                state_key: '',
                origin_server_ts: 1000,
                content: '{ body: test message }',
                topological_ordering: 0,
                processed: 1,
                outlier: 0
              })

              await clientServer.matrixDb.insert('room_memberships', {
                room_id: '!testroom:example.com',
                user_id: '@testuser:example.com',
                membership: 'join',
                event_id: 'adding_user',
                sender: '@admin:example.com'
              })

              await clientServer.matrixDb.insert('events', {
                event_id: 'adding_user',
                room_id: '!testroom:example.com',
                sender: '@admin:example.com',
                type: 'm.room.message',
                origin_server_ts: 0,
                content: JSON.stringify({ body: 'test message' }),
                topological_ordering: 0,
                processed: 2,
                outlier: 0
              })

              logger.info('Test event created')
            } catch (e) {
              logger.error('Error setting up test data:', e)
            }
          })

          afterAll(async () => {
            try {
              await clientServer.matrixDb.deleteEqual(
                'events',
                'event_id',
                'event_to_retrieve'
              )
              await clientServer.matrixDb.deleteEqual(
                'events',
                'event_id',
                'adding_user'
              )
              await clientServer.matrixDb.deleteEqual(
                'room_memberships',
                'event_id',
                'adding_user'
              )
              logger.info('Test event deleted')
            } catch (e) {
              logger.error('Error tearing down test data', e)
            }
          })
          it('should return 404 if the event does not exist', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/event/invalid_event_id'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(404)
          })
          it('should 404 if the user has never been in the room', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/event/event_to_retrieve'
              )
              .set('Authorization', `Bearer ${validToken2}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(404)
          })
          it('should return 200 if the event can be retrieved by the user', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/event/event_to_retrieve'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(200)
            expect(response.body).toHaveProperty(
              'event_id',
              'event_to_retrieve'
            )
            expect(response.body).toHaveProperty(
              'room_id',
              '!testroom:example.com'
            )
            expect(response.body).toHaveProperty(
              'sender',
              '@sender:example.com'
            )
            expect(response.body).toHaveProperty('type', 'm.room.message')
            expect(response.body).toHaveProperty('origin_server_ts', 1000)
            expect(response.body).toHaveProperty(
              'content',
              '{ body: test message }'
            )
          })
          it('should return 404 if the user was not in the room at the time of the event', async () => {
            try {
              await clientServer.matrixDb.insert('room_memberships', {
                room_id: '!testroom:example.com',
                user_id: '@testuser:example.com',
                membership: 'leave',
                event_id: 'deleting_user',
                sender: '@admin:example.com'
              })

              await clientServer.matrixDb.insert('events', {
                event_id: 'deleting_user',
                room_id: '!testroom:example.com',
                sender: '@admin:example.com',
                type: 'm.room.message',
                origin_server_ts: 50,
                content: JSON.stringify({ body: 'test message' }),
                topological_ordering: 0,
                processed: 2,
                outlier: 0
              })
              logger.info('Test event created')
            } catch (e) {
              logger.error('Error tearing down test data', e)
            }
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/event/event_to_retrieve'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(404)

            try {
              await clientServer.matrixDb.deleteEqual(
                'room_memberships',
                'event_id',
                'deleting_user'
              )
              await clientServer.matrixDb.deleteEqual(
                'events',
                'event_id',
                'deleting_user'
              )
              logger.info('Test event deleted')
            } catch (e) {
              logger.error('Error tearing down test data', e)
            }
          })
        })

        describe('/_matrix/client/v3/rooms/:roomId/joined_members', () => {
          beforeAll(async () => {
            try {
              await clientServer.matrixDb.insert('local_current_membership', {
                room_id: '!testroom:example.com',
                user_id: '@testuser:example.com',
                membership: 'join',
                event_id: 'joining_user'
              })

              await clientServer.matrixDb.insert('profiles', {
                user_id: '@testuser:example.com',
                displayname: 'Test User',
                avatar_url: 'http://example.com/avatar.jpg'
              })

              await clientServer.matrixDb.insert('local_current_membership', {
                room_id: '!testroom:example.com',
                user_id: '@admin:example.com',
                membership: 'join',
                event_id: 'joining_admin'
              })

              await clientServer.matrixDb.insert('profiles', {
                user_id: '@admin:example.com',
                displayname: 'Admin User',
                avatar_url: 'http://example.com/avatarAdmin.jpg'
              })

              await clientServer.matrixDb.insert('local_current_membership', {
                room_id: '!testroom:example.com',
                user_id: '@visit:example.com',
                membership: 'leave',
                event_id: 'leaving_user'
              })

              await clientServer.matrixDb.insert('profiles', {
                user_id: '@visit:example.com',
                displayname: 'Visiting User',
                avatar_url: 'http://example.com/avatarExample.jpg'
              })

              logger.info('Test event created')
            } catch (e) {
              logger.error('Error setting up test data:', e)
            }
          })

          afterAll(async () => {
            try {
              await clientServer.matrixDb.deleteEqual(
                'local_current_membership',
                'event_id',
                'joining_user'
              )
              await clientServer.matrixDb.deleteEqual(
                'local_current_membership',
                'event_id',
                'joining_admin'
              )
              await clientServer.matrixDb.deleteEqual(
                'local_current_membership',
                'event_id',
                'leaving_user'
              )
              await clientServer.matrixDb.deleteEqual(
                'profiles',
                'user_id',
                '@testuser:example.com'
              )
              await clientServer.matrixDb.deleteEqual(
                'profiles',
                'user_id',
                '@admin:example.com'
              )
              await clientServer.matrixDb.deleteEqual(
                'profiles',
                'user_id',
                '@visit:example.com'
              )
              logger.info('Test event deleted')
            } catch (e) {
              logger.error('Error tearing down test data', e)
            }
          })
          it('should return 404 if the user is not in the room', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/joined_members'
              )
              .set('Authorization', `Bearer ${validToken2}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(404)
          })
          it('should return 200 if the user is in the room', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/joined_members'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(200)
            expect(response.body).toHaveProperty('joined')
            expect(response.body.joined['@testuser:example.com']).toBeDefined
            expect(
              response.body.joined['@testuser:example.com']
            ).toHaveProperty('display_name', 'Test User')
            expect(
              response.body.joined['@testuser:example.com']
            ).toHaveProperty('avatar_url', 'http://example.com/avatar.jpg')
            expect(response.body.joined['@admin:example.com']).toBeDefined
            expect(response.body.joined['@admin:example.com']).toHaveProperty(
              'display_name',
              'Admin User'
            )
            expect(response.body.joined['@admin:example.com']).toHaveProperty(
              'avatar_url',
              'http://example.com/avatarAdmin.jpg'
            )
          })
        })

        describe('/_matrix/client/v3/rooms/:roomId/timestamp_to_event', () => {
          beforeAll(async () => {
            try {
              await clientServer.matrixDb.insert('events', {
                event_id: 'event1',
                room_id: '!testroom:example.com',
                sender: '@sender:example.com',
                type: 'm.room.message',
                state_key: '',
                origin_server_ts: 1000,
                content: '{ body: test message }',
                topological_ordering: 0,
                processed: 1,
                outlier: 0
              })
              await clientServer.matrixDb.insert('events', {
                event_id: 'event2',
                room_id: '!testroom:example.com',
                sender: '@sender:example.com',
                type: 'm.room.message',
                state_key: '',
                origin_server_ts: 2000,
                content: '{ body: test message }',
                topological_ordering: 1,
                processed: 1,
                outlier: 0
              })
              await clientServer.matrixDb.insert('events', {
                event_id: 'event3',
                room_id: '!testroom:example.com',
                sender: '@sender:example.com',
                type: 'm.room.message',
                state_key: '',
                origin_server_ts: 3000,
                content: '{ body: test message }',
                topological_ordering: 2,
                processed: 1,
                outlier: 0
              })

              logger.info('Test events created')
            } catch (e) {
              logger.error('Error setting up test data', e)
            }
          })
          afterAll(async () => {
            try {
              await clientServer.matrixDb.deleteEqual(
                'events',
                'event_id',
                'event1'
              )
              await clientServer.matrixDb.deleteEqual(
                'events',
                'event_id',
                'event2'
              )
              await clientServer.matrixDb.deleteEqual(
                'events',
                'event_id',
                'event3'
              )
            } catch (e) {
              logger.error('Error tearing down test data', e)
            }
          })

          it('should return 400 if the query parameters are incorrect', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/timestamp_to_event'
              )
              .query({ dir: 'unsupported_string', ts: 500 })
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
          })

          it('should return 404 if the event does not exist (forward)', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/timestamp_to_event'
              )
              .query({ dir: 'f', ts: 3500 })
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(404)
            expect(response.body.errcode).toBe('M_NOT_FOUND')
          })

          it('should return 404 if the event does not exist (backward)', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/timestamp_to_event'
              )
              .query({ dir: 'b', ts: 500 })
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(404)
            expect(response.body.errcode).toBe('M_NOT_FOUND')
          })

          it('should return 200 if the event can be retrieved (forward)', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/timestamp_to_event'
              )
              .query({ dir: 'f', ts: 1500 })
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(200)
            expect(response.body).toHaveProperty('event_id', 'event2')
          })
          it('should return 200 if the event can be retrieved (backward)', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/rooms/!testroom:example.com/timestamp_to_event'
              )
              .query({ dir: 'b', ts: 2500 })
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(200)
            expect(response.body).toHaveProperty('event_id', 'event2')
          })
        })
      })
    })

    describe('/_matrix/client/v3/user/:userId/rooms/:roomId/tags', () => {
      const testUserId = '@testuser:example.com'
      const testRoomId = '!testroomid:example.com'

      beforeAll(async () => {
        try {
          await clientServer.matrixDb.insert('room_tags', {
            user_id: testUserId,
            room_id: testRoomId,
            tag: 'test_tag',
            content: JSON.stringify({ order: 1 })
          })
          await clientServer.matrixDb.insert('room_tags', {
            user_id: testUserId,
            room_id: testRoomId,
            tag: 'test_tag2',
            content: JSON.stringify({ order: 0.5 })
          })
        } catch (e) {
          logger.error('Error setting up test data:', e)
        }
      })

      afterAll(async () => {
        try {
          await clientServer.matrixDb.deleteEqual(
            'room_tags',
            'tag',
            'test_tag'
          )
          await clientServer.matrixDb.deleteEqual(
            'room_tags',
            'tag',
            'test_tag2'
          )
        } catch (e) {
          logger.error('Error tearing down test data:', e)
        }
      })
      describe('GET', () => {
        it('should require authentication', async () => {
          const response = await request(app)
            .get(
              `/_matrix/client/v3/user/${testUserId}/rooms/${testRoomId}/tags`
            )
            .set('Authorization', 'Bearer invalidToken')
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(401)
        })

        it('should return the tags for the room', async () => {
          const response = await request(app)
            .get(
              `/_matrix/client/v3/user/${testUserId}/rooms/${testRoomId}/tags`
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('tags')
          expect(response.body.tags).toEqual({
            test_tag: { order: 1 },
            test_tag2: { order: 0.5 }
          })
        })
      })

      describe('PUT', () => {
        const testTag = 'new_tag'

        it('should require authentication', async () => {
          const response = await request(app)
            .put(
              `/_matrix/client/v3/user/${testUserId}/rooms/${testRoomId}/tags/${testTag}`
            )
            .set('Authorization', 'Bearer invalidToken')
            .set('Accept', 'application/json')
            .send({ order: 0.2 })

          expect(response.statusCode).toBe(401)
        })

        it('should add a tag to the room', async () => {
          const response = await request(app)
            .put(
              `/_matrix/client/v3/user/${testUserId}/rooms/${testRoomId}/tags/${testTag}`
            )
            .set('Authorization', `Bearer ${validToken}`)
            .send({ order: 0.2 })
          expect(response.statusCode).toBe(200)
          const rows = await clientServer.matrixDb.get(
            'room_tags',
            ['tag', 'content'],
            {
              user_id: testUserId,
              room_id: testRoomId
            }
          )
          expect(rows[0]).toEqual({
            tag: testTag,
            content: JSON.stringify({ order: 0.2 })
          })
        })
      })

      describe('DELETE', () => {
        const testTag = 'test_tag'

        it('should require authentication', async () => {
          const response = await request(app)
            .delete(
              `/_matrix/client/v3/user/${testUserId}/rooms/${testRoomId}/tags/${testTag}`
            )
            .set('Authorization', 'Bearer invalidToken')
            .set('Accept', 'application/json')

          expect(response.statusCode).toBe(401)
        })

        it('should delete the tag from the room', async () => {
          const response = await request(app)
            .delete(
              `/_matrix/client/v3/user/${testUserId}/rooms/${testRoomId}/tags/${testTag}`
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')

          expect(response.statusCode).toBe(200)
          const rows = await clientServer.matrixDb.get('room_tags', ['tag'], {
            user_id: testUserId,
            room_id: testRoomId
          })
          expect(rows).not.toContainEqual({ tag: testTag })
        })
      })
    })

    describe('/_matrix/client/v3/joined_rooms', () => {
      const testUserId = '@testuser:example.com'
      const testRoomIds = ['!foo:example.com', '!bar:example.com']
      const testRoomIdBan = '!ban:example.com'

      beforeAll(async () => {
        try {
          await Promise.all(
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            testRoomIds.map((roomId) =>
              clientServer.matrixDb.insert('local_current_membership', {
                user_id: testUserId,
                room_id: roomId,
                membership: 'join',
                event_id: randomString(20)
              })
            )
          )

          await clientServer.matrixDb.insert('local_current_membership', {
            user_id: testUserId,
            room_id: testRoomIdBan,
            membership: 'ban',
            event_id: randomString(20)
          })
        } catch (e) {
          logger.error('Error setting up test data:', e)
        }
      })

      afterAll(async () => {
        // Clean up test data
        await clientServer.matrixDb.deleteEqual(
          'local_current_membership',
          'user_id',
          testUserId
        )
      })

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/joined_rooms')
          .set('Authorization', 'Bearer invalidToken')
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })

      it('should return the list of rooms the user has joined', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/joined_rooms')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body).toEqual({
          joined_rooms: testRoomIds
        })
      })
    })
  })
})
