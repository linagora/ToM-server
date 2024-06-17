import { getLogger, type TwakeLogger } from '@twake/logger'
import request from 'supertest'
import express from 'express'
import IdentityServerDB from '../db'
import { type Config } from '../types'
import isPubkeyValid from './validPubkey'
import isEphemeralPubkeyValid from './validEphemeralPubkey'
import defaultConfig from '../__testData__/registerConf.json'

let app: express.Application
let conf: Config

// Mock fetch if necessary

beforeAll(async () => {
  conf = {
    ...defaultConfig,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    cron_service: false
  }
})

const logger: TwakeLogger = getLogger()

describe('Key validation', () => {
  let db: IdentityServerDB

  beforeAll(async () => {
    app = express()
    db = new IdentityServerDB(conf, logger)

    await db.ready
    app.get('/_matrix/identity/v2/pubkey/isvalid', isPubkeyValid(db, logger))
    app.get(
      '/_matrix/identity/v2/ephemeral_pubkey/isvalid',
      isEphemeralPubkeyValid(db, logger)
    )

    // Insert a test key into the database
    await db.insert('longTermKeypairs', {
      keyID: 'testID',
      public: 'testPub',
      private: 'testPri'
    })
    await db.insert('shortTermKeypairs', {
      keyID: 'testID',
      public: 'testPub',
      private: 'testPri'
    })
  })

  afterAll(async () => {
    clearTimeout(db.cleanJob)
    db.close()
    logger.close()
  })

  it('should validate a valid long-term pubkey', async () => {
    const key = 'testPub'
    const response = await request(app)
      .get('/_matrix/identity/v2/pubkey/isvalid')
      .send({ public_key: key })
    expect(response.statusCode).toBe(200)
    expect(response.body.valid).toBe(true)
  })

  it('should invalidate an invalid long-term pubkey', async () => {
    const key = 'invalidPub'
    const response = await request(app)
      .get('/_matrix/identity/v2/pubkey/isvalid')
      .send({ public_key: key })
    expect(response.statusCode).toBe(200)
    expect(response.body.valid).toBe(false)
  })

  it('should validate a valid ephemeral pubkey', async () => {
    const key = 'testPub'
    const response = await request(app)
      .get('/_matrix/identity/v2/ephemeral_pubkey/isvalid')
      .send({ public_key: key })
    expect(response.statusCode).toBe(200)
    expect(response.body.valid).toBe(true)
  })

  it('should invalidate an invalid ephemeral pubkey', async () => {
    const key = 'invalidPub'
    const response = await request(app)
      .get('/_matrix/identity/v2/ephemeral_pubkey/isvalid')
      .send({ public_key: key })
    expect(response.statusCode).toBe(200)
    expect(response.body.valid).toBe(false)
  })
})
