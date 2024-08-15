import { getLogger, type TwakeLogger } from '@twake/logger'
import { randomString } from '@twake/crypto'
import ClientServer from '../index'
import { type Config } from '../types'
import express from 'express'
import defaultConfig from '../__testData__/registerConf.json'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import fs from 'fs'
import request from 'supertest'
import {
  setupTokens,
  validToken,
  validToken2
} from '../__testData__/setupTokens'

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
    matrix_database_engine: 'sqlite',
    matrix_database_host: './src/__testData__/testMatrixUserData.db',
    database_host: './src/__testData__/testUserData.db',
    userdb_host: './src/__testData__/testUserData.db'
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
  fs.unlinkSync('./src/__testData__/testMatrixUserData.db')
  fs.unlinkSync('./src/__testData__/testUserData.db')
})

describe('Use configuration file', () => {
  beforeAll((done) => {
    clientServer = new ClientServer(conf)
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

  describe('/_matrix/client/v3/profile/:userId', () => {
    describe('GET', () => {
      const testUserId = '@testuser:example.com'
      const incompleteUserId = '@incompleteuser:example.com'

      beforeAll(async () => {
        try {
          await clientServer.matrixDb.insert('profiles', {
            user_id: testUserId,
            displayname: 'Test User',
            avatar_url: 'http://example.com/avatar.jpg'
          })
          logger.info('Test user profile created')

          await clientServer.matrixDb.insert('profiles', {
            user_id: incompleteUserId
          })
          logger.info('Incomplete test user profile created')
        } catch (e) {
          logger.error('Error creating profiles:', e)
        }
      })

      afterAll(async () => {
        try {
          await clientServer.matrixDb.deleteEqual(
            'profiles',
            'user_id',
            testUserId
          )
          logger.info('Test user profile deleted')

          await clientServer.matrixDb.deleteEqual(
            'profiles',
            'user_id',
            incompleteUserId
          )
          logger.info('Incomplete test user profile deleted')
        } catch (e) {
          logger.error('Error deleting profiles:', e)
        }
      })

      describe('/_matrix/client/v3/profile/:userId', () => {
        it('should return the profile information for an existing user', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/profile/${testUserId}`
          )

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('avatar_url')
          expect(response.body).toHaveProperty('displayname')
        })

        // it('should return error 403 if the server is unwilling to disclose profile information', async () => {
        //   const response = await request(app).get(
        //     '/_matrix/client/v3/profile/@forbiddenuser:example.com'
        //   )

        //   expect(response.statusCode).toBe(403)
        //   expect(response.body.errcode).toBe('M_FORBIDDEN')
        //   expect(response.body).toHaveProperty('error')
        // })

        it('should return error 404 if the user does not exist', async () => {
          const response = await request(app).get(
            '/_matrix/client/v3/profile/@nonexistentuser:example.com'
          )

          expect(response.statusCode).toBe(404)
          expect(response.body.errcode).toBe('M_NOT_FOUND')
          expect(response.body).toHaveProperty('error')
        })
      })

      describe('/_matrix/client/v3/profile/:userId/avatar_url', () => {
        it('should return the avatar_url for an existing user', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/profile/${testUserId}/avatar_url`
          )

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('avatar_url')
        })

        it('should return error 404 if the user does not exist', async () => {
          const response = await request(app).get(
            '/_matrix/client/v3/profile/@nonexistentuser:example.com/avatar_url'
          )
          expect(response.statusCode).toBe(404)
          expect(response.body.errcode).toBe('M_NOT_FOUND')
          expect(response.body).toHaveProperty('error')
        })

        it('should return error 404 if the user does not have an existing avatar_url', async () => {
          const response = await request(app).get(
            '/_matrix/client/v3/profile/@incompleteuser:example.com/avatar_url'
          )
          expect(response.statusCode).toBe(404)
          expect(response.body.errcode).toBe('M_NOT_FOUND')
          expect(response.body).toHaveProperty('error')
        })
      })

      describe('/_matrix/client/v3/profile/:userId/displayname', () => {
        it('should return the displayname for an existing user', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/profile/${testUserId}/displayname`
          )

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('displayname')
        })

        it('should return error 404 if the user does not exist', async () => {
          const response = await request(app).get(
            '/_matrix/client/v3/profile/@nonexistentuser:example.com/displayname'
          )

          expect(response.statusCode).toBe(404)
          expect(response.body.errcode).toBe('M_NOT_FOUND')
          expect(response.body).toHaveProperty('error')
        })

        it('should return error 404 if the user does not have an existing avatar_url', async () => {
          const response = await request(app).get(
            '/_matrix/client/v3/profile/@incompleteuser:example.com/displayname'
          )

          expect(response.statusCode).toBe(404)
          expect(response.body.errcode).toBe('M_NOT_FOUND')
          expect(response.body).toHaveProperty('error')
        })
      })
    })
  })

  describe('Endpoints with authentication', () => {
    beforeAll(async () => {
      await setupTokens(clientServer, logger)
    })

    describe('/_matrix/client/v3/profile/:userId', () => {
      describe('PUT', () => {
        const testUserId = '@testuser:example.com'
        beforeAll(async () => {
          try {
            await clientServer.matrixDb.insert('users', {
              name: '@testuser2:example.com',
              admin: 1
            })
            await clientServer.matrixDb.insert('users', {
              name: '@testuser3:example.com',
              admin: 0
            })
            await clientServer.matrixDb.insert('profiles', {
              user_id: testUserId,
              displayname: 'Test User',
              avatar_url: 'http://example.com/avatar.jpg'
            })
            logger.info('Test user profile created')
          } catch (e) {
            logger.error('Error creating test user profile:', e)
          }
        })

        afterAll(async () => {
          try {
            await clientServer.matrixDb.deleteEqual(
              'users',
              'name',
              '@testuser2:example.com'
            )
            await clientServer.matrixDb.deleteEqual(
              'users',
              'name',
              '@testuser3:example.com'
            )
            await clientServer.matrixDb.deleteEqual(
              'profiles',
              'user_id',
              testUserId
            )
            logger.info('Test user profile deleted')
          } catch (e) {
            logger.error('Error deleting test user profile:', e)
          }
        })

        describe('/_matrix/client/v3/profile/:userId/avatar_url', () => {
          it('should require authentication', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', 'Bearer invalidToken')
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(401)
          })

          it('should return 400 if the target user is on a remote server', async () => {
            const response = await request(app)
              .put(
                `/_matrix/client/v3/profile/@testuser:anotherexample.com/avatar_url`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })
            expect(response.statusCode).toBe(400)
          })

          it('should return 403 if the requester is not admin and is not the target user', async () => {
            const response = await request(app)
              .put(
                `/_matrix/client/v3/profile/@testuser2:example.com/avatar_url`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })
            expect(response.statusCode).toBe(403)
          })

          it('should return 403 if the requester is not admin and the config does not allow changing avatar_url', async () => {
            clientServer.conf.capabilities.enable_set_avatar_url = false

            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')

            clientServer.conf.capabilities.enable_set_avatar_url = true
          })

          it('should return 400 if provided avatar_url is too long', async () => {
            clientServer.conf.capabilities.enable_set_avatar_url = true
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ avatar_url: randomString(2049) })
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })

          it('should send correct response when requester is admin and target user is on local server', async () => {
            clientServer.conf.capabilities.enable_set_avatar_url = true
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', `Bearer ${validToken2}`)
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })

            expect(response.statusCode).toBe(200)
            expect(response.body).toEqual({})
          })

          it('should send correct response when requester is target user (on local server)', async () => {
            clientServer.conf.capabilities.enable_set_avatar_url = true
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })

            expect(response.statusCode).toBe(200)
            expect(response.body).toEqual({})
          })

          it('should correctly update the avatar_url of an existing user', async () => {
            clientServer.conf.capabilities.enable_set_avatar_url = undefined
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/avatar_url`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({ avatar_url: 'http://example.com/new_avatar.jpg' })
            expect(response.statusCode).toBe(200)
            const rows = await clientServer.matrixDb.get(
              'profiles',
              ['avatar_url'],
              { user_id: testUserId }
            )

            expect(rows.length).toBe(1)
            expect(rows[0].avatar_url).toBe('http://example.com/new_avatar.jpg')
          })
        })

        describe('/_matrix/client/v3/profile/{userId}/displayname', () => {
          it('should require authentication', async () => {
            await clientServer.cronTasks?.ready
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
              .set('Authorization', 'Bearer invalidToken')
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(401)
          })

          it('should return 400 if the target user is on a remote server', async () => {
            const response = await request(app)
              .put(
                `/_matrix/client/v3/profile/@testuser:anotherexample.com/displayname`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ displayname: 'New name' })
            expect(response.statusCode).toBe(400)
          })

          it('should return 403 if the requester is not admin and is not the target user', async () => {
            const response = await request(app)
              .put(
                `/_matrix/client/v3/profile/@testuser2:example.com/displayname`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ displayname: 'New name' })
            expect(response.statusCode).toBe(403)
          })

          it('should return 403 if the requester is not admin and the config does not allow changing display_name', async () => {
            clientServer.conf.capabilities.enable_set_displayname = false

            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ displayname: 'New name' })
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')

            clientServer.conf.capabilities.enable_set_displayname = true
          })

          it('should return 400 if provided display_name is too long', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ displayname: randomString(257) })
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })

          it('should send correct response when requester is admin and target user is on local server', async () => {
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
              .set('Authorization', `Bearer ${validToken2}`)
              .send({ displayname: 'New name' })

            expect(response.statusCode).toBe(200)
            expect(response.body).toEqual({})
          })

          it('should correctly update the display_name of an existing user', async () => {
            clientServer.conf.capabilities.enable_set_displayname = undefined
            const response = await request(app)
              .put(`/_matrix/client/v3/profile/${testUserId}/displayname`)
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ displayname: 'New name' })
            expect(response.statusCode).toBe(200)
            const rows = await clientServer.matrixDb.get(
              'profiles',
              ['displayname'],
              { user_id: testUserId }
            )

            expect(rows.length).toBe(1)
            expect(rows[0].displayname).toBe('New name')
          })
        })
      })
    })

    describe('/_matrix/client/v3/user_directory/search', () => {
      describe('POST', () => {
        const testUserId = '@testuser:example.com'
        const anotherUserId = '@anotheruser:example.com'
        const publicRoomUserId = '@publicroomuser:example.com'
        const sharedRoomUserId = '@sharedroomuser:example.com'

        beforeAll(async () => {
          // Setup test data
          try {
            // Populate the user_directory table
            await clientServer.matrixDb.insert('user_directory', {
              user_id: testUserId,
              display_name: 'Test User',
              avatar_url: 'http://example.com/avatar.jpg'
            })
            await clientServer.matrixDb.insert('user_directory', {
              user_id: anotherUserId,
              display_name: 'Another User',
              avatar_url: 'http://example.com/another_avatar.jpg'
            })
            await clientServer.matrixDb.insert('user_directory', {
              user_id: publicRoomUserId,
              display_name: 'Public Room User',
              avatar_url: 'http://example.com/public_avatar.jpg'
            })
            await clientServer.matrixDb.insert('user_directory', {
              user_id: sharedRoomUserId,
              display_name: 'Shared Room User',
              avatar_url: 'http://example.com/shared_avatar.jpg'
            })

            // Populate the user_directory_search table
            await clientServer.matrixDb.insert('user_directory_search', {
              user_id: testUserId,
              value: 'Test User http://example.com/avatar.jpg'
            })
            await clientServer.matrixDb.insert('user_directory_search', {
              user_id: anotherUserId,
              value: 'Another user http://example.com/another_avatar.jpg'
            })
            await clientServer.matrixDb.insert('user_directory_search', {
              user_id: publicRoomUserId,
              value: 'Public Room User http://example.com/public_avatar.jpg'
            })
            await clientServer.matrixDb.insert('user_directory_search', {
              user_id: sharedRoomUserId,
              value: 'Shared Room User http://example.com/shared_avatar.jpg'
            })

            // Populate the users table
            await clientServer.matrixDb.insert('users', {
              name: anotherUserId
            })
            await clientServer.matrixDb.insert('users', {
              name: publicRoomUserId
            })
            await clientServer.matrixDb.insert('users', {
              name: sharedRoomUserId
            })

            // Populate the users_in_public_rooms table
            await clientServer.matrixDb.insert('users_in_public_rooms', {
              user_id: publicRoomUserId,
              room_id: '!publicroom:example.com'
            })

            // Populate the users_who_share_private_rooms table
            await clientServer.matrixDb.insert(
              'users_who_share_private_rooms',
              {
                user_id: testUserId,
                other_user_id: sharedRoomUserId,
                room_id: '!sharedroom:example.com'
              }
            )

            // Add more users and data as needed for testing
          } catch (e) {
            clientServer.logger.error('Error creating user directory data:', e)
          }
        })

        afterAll(async () => {
          // Cleanup test data
          try {
            await clientServer.matrixDb.deleteEqual(
              'user_directory',
              'user_id',
              testUserId
            )
            await clientServer.matrixDb.deleteEqual(
              'user_directory',
              'user_id',
              anotherUserId
            )
            await clientServer.matrixDb.deleteEqual(
              'user_directory_search',
              'user_id',
              testUserId
            )
            await clientServer.matrixDb.deleteEqual(
              'user_directory_search',
              'user_id',
              anotherUserId
            )
            await clientServer.matrixDb.deleteEqual('users', 'name', testUserId)
            await clientServer.matrixDb.deleteEqual(
              'users',
              'name',
              anotherUserId
            )
            await clientServer.matrixDb.deleteEqual(
              'users_in_public_rooms',
              'user_id',
              publicRoomUserId
            )
            await clientServer.matrixDb.deleteEqual(
              'users_who_share_private_rooms',
              'user_id',
              sharedRoomUserId
            )
            await clientServer.matrixDb.deleteEqual(
              'users_who_share_private_rooms',
              'other_user_id',
              testUserId
            )
            // Delete more users and data as needed
          } catch (e) {
            clientServer.logger.error('Error deleting user directory data:', e)
          }
        })

        it('should require authentication', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer invalidToken`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'anotheruser',
              limit: 5
            })

          expect(response.statusCode).toBe(401)
        })

        it('should set the limit to 10 when none is provided', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'anotheruser'
            })

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('results')
          expect(response.body.limited).toBe(false)
        })

        it('should set the searchAll parameter to false when the config does not specify it', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'anotheruser'
            })

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('results')
          expect(response.body.results.length).toBe(0)
        })

        it('should return error 400 if invalid limit is provided', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'anotheruser',
              limit: 'invalid'
            })

          expect(response.statusCode).toBe(400)
          expect(response.body.errcode).toBe('M_MISSING_PARAMS')
        })

        it('should return error 400 if invalid search term (or no search Term) is provided', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              limit: 5
            })

          expect(response.statusCode).toBe(400)
          expect(response.body.errcode).toBe('M_MISSING_PARAMS')
        })

        it('should return search results for users when searchAll is enabled', async () => {
          clientServer.conf.user_directory.enable_all_users_search = true
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'another user',
              limit: 5
            })

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('results')
          expect(response.body.results.length).toBeGreaterThan(0)
          expect(response.body.results[0]).toHaveProperty('user_id')
          expect(response.body.results[0]).toHaveProperty('display_name')
          expect(response.body.results[0]).toHaveProperty('avatar_url')

          clientServer.conf.user_directory.enable_all_users_search = false
        })

        it('should return correct search results (searchAll disabled and searching public user)', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'public',
              limit: 5
            })

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('results')
          expect(response.body.results.length).toBe(1)
          expect(response.body.results[0].user_id).toBe(publicRoomUserId)
          expect(response.body.results[0].display_name).toBe('Public Room User')
          expect(response.body.results[0].avatar_url).toBe(
            'http://example.com/public_avatar.jpg'
          )
        })

        it('should return correct search results (searchAll disabled and searching sharing room user)', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'shared',
              limit: 5
            })

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('results')
          expect(response.body.results.length).toBe(1)
          expect(response.body.results[0].user_id).toBe(sharedRoomUserId)
          expect(response.body.results[0].display_name).toBe('Shared Room User')
          expect(response.body.results[0].avatar_url).toBe(
            'http://example.com/shared_avatar.jpg'
          )
        })

        it('should return no results for non-existent user', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'nonExistentSearchTerm',
              limit: 5
            })

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('results')
          expect(response.body.results.length).toBe(0)
        })

        it('should return no results for a non-existent search term when searchAllUsers is enabled', async () => {
          clientServer.conf.user_directory.enable_all_users_search = true
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'nonexistentterm',
              limit: 5
            })

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('results')
          expect(response.body.results.length).toBe(0)
          clientServer.conf.user_directory.enable_all_users_search = false
        })

        it('should respect the limit parameter', async () => {
          clientServer.conf.user_directory.enable_all_users_search = true
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'User',
              limit: 2
            })
          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('results')
          expect(response.body.results.length).toBe(2)
          clientServer.conf.user_directory.enable_all_users_search = false
        })

        it('should handle search term with special characters', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: '@user!#',
              limit: 5
            })

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('results')
          expect(response.body.results.length).toBe(2)
        })

        it('should perform case-insensitive search', async () => {
          const response = await request(app)
            .post('/_matrix/client/v3/user_directory/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({
              search_term: 'PUBLIC USER',
              limit: 5
            })

          expect(response.statusCode).toBe(200)
          expect(response.body).toHaveProperty('results')
          expect(response.body.results.length).toBe(1)
          expect(response.body.results[0]).toHaveProperty(
            'user_id',
            publicRoomUserId
          )
        })
      })
    })
  })
})
