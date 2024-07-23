import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../index'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import { type Config } from '../types'
import defaultConfig from '../__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'

jest.mock('node-fetch', () => jest.fn())

let conf: Config
let clientServer: ClientServer
let app: express.Application

const logger: TwakeLogger = getLogger()

describe('/_matrix/client/v1/media/config', () => {
  it('should correctly return the upload size limit when the config specifies it', async () => {
    // @ts-expect-error TS doesn't understand that the config is valid
    conf = {
      ...defaultConfig,
      cron_service: false,
      database_engine: 'sqlite',
      base_url: 'http://example.com/',
      userdb_engine: 'sqlite',
      matrix_database_engine: 'sqlite',
      media: { uploadSizeLim: 100000000 }
    }

    try {
      await buildUserDB(conf)

      await buildMatrixDb(conf)
    } catch (e) {
      logger.error('Error while building matrix db:', e)
    }

    clientServer = new ClientServer(conf)
    app = express()

    try {
      await clientServer.ready

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
    } catch (e) {
      logger.error('Error while building matrix db:', e)
    }

    const response = await request(app).get('/_matrix/client/v1/media/config')

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ 'm.upload.size': 100000000 })

    clientServer.cleanJobs()

    if (fs.existsSync('src/__testData__/test.db')) {
      fs.unlinkSync('src/__testData__/test.db')
    }
    if (fs.existsSync('src/__testData__/testMatrix.db')) {
      fs.unlinkSync('src/__testData__/testMatrix.db')
    }
  })

  it('should return 500 when config.media is null', async () => {
    // @ts-expect-error TS doesn't understand that the config is valid
    conf = {
      ...defaultConfig,
      cron_service: false,
      database_engine: 'sqlite',
      base_url: 'http://example.com/',
      userdb_engine: 'sqlite',
      matrix_database_engine: 'sqlite',
      media: undefined
    }

    try {
      await buildUserDB(conf)

      await buildMatrixDb(conf)
    } catch (e) {
      logger.error('Error while building matrix db:', e)
    }

    clientServer = new ClientServer(conf)
    app = express()

    try {
      await clientServer.ready

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
    } catch (e) {
      logger.error('Error while building matrix db:', e)
    }

    const response = await request(app).get('/_matrix/client/v1/media/config')

    expect(response.statusCode).toBe(500)

    clientServer.cleanJobs()

    if (fs.existsSync('src/__testData__/test.db')) {
      fs.unlinkSync('src/__testData__/test.db')
    }
    if (fs.existsSync('src/__testData__/testMatrix.db')) {
      fs.unlinkSync('src/__testData__/testMatrix.db')
    }
  })

  it('should return 500 when the upload size limit is not listed in the config', async () => {
    // @ts-expect-error TS doesn't understand that the config is valid
    conf = {
      ...defaultConfig,
      cron_service: false,
      database_engine: 'sqlite',
      base_url: 'http://example.com/',
      userdb_engine: 'sqlite',
      matrix_database_engine: 'sqlite',
      media: {}
    }

    try {
      await buildUserDB(conf)

      await buildMatrixDb(conf)
    } catch (e) {
      logger.error('Error while building matrix db:', e)
    }

    clientServer = new ClientServer(conf)
    app = express()

    try {
      await clientServer.ready

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
    } catch (e) {
      logger.error('Error while building matrix db:', e)
    }

    const response = await request(app).get('/_matrix/client/v1/media/config')

    expect(response.statusCode).toBe(500)

    clientServer.cleanJobs()

    if (fs.existsSync('src/__testData__/test.db')) {
      fs.unlinkSync('src/__testData__/test.db')
    }
    if (fs.existsSync('src/__testData__/testMatrix.db')) {
      fs.unlinkSync('src/__testData__/testMatrix.db')
    }
  })
})
