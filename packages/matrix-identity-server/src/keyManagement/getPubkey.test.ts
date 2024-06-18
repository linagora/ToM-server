import { getLogger, type TwakeLogger } from '@twake/logger'
import { generateKeyPair } from '@twake/crypto'
import request from 'supertest'
import express from 'express'
import IdentityServerDB from '../db'
import { type Config } from '../types'
import defaultConfig from '../__testData__/registerConf.json'
import getPubkey from './getPubkey'

let app: express.Application
let conf: Config

const logger: TwakeLogger = getLogger()
const longKeyPair: { publicKey: string; privateKey: string; keyId: string } =
  generateKeyPair('ed25519')
const shortKeyPair: { publicKey: string; privateKey: string; keyId: string } =
  generateKeyPair('curve25519')

beforeAll(async () => {
  conf = {
    ...defaultConfig,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    cron_service: false
  }
})

describe('Get public key from keyID', () => {
  let db: IdentityServerDB

  beforeAll(async () => {
    app = express()
    db = new IdentityServerDB(conf, logger)

    await db.ready
    app.get(`/_matrix/identity/v2/pubkey/:keyId`, getPubkey(db, logger))

    // Insert a test key into the database
    await db.insert('longTermKeypairs', {
      keyID: longKeyPair.keyId,
      public: longKeyPair.publicKey,
      private: longKeyPair.privateKey
    })
    await db.insert('shortTermKeypairs', {
      keyID: shortKeyPair.keyId,
      public: shortKeyPair.publicKey,
      private: shortKeyPair.privateKey
    })
  })

  afterAll(async () => {
    clearTimeout(db.cleanJob)
    db.close()
    logger.close()
  })

  it('should return the public key when correct keyID is given (from long term key pairs)', async () => {
    const _keyID = longKeyPair.keyId
    const response = await request(app).get(
      `/_matrix/identity/v2/pubkey/${_keyID}`
    )

    expect(response.statusCode).toBe(200)
    expect(response.body.public_key).toBeDefined()
    expect(response.body.public_key).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(response.body.public_key).toBe(longKeyPair.publicKey)
  })

  it('should return the public key when correct keyID is given (from short term key pairs)', async () => {
    const _keyID = shortKeyPair.keyId
    const response = await request(app).get(
      `/_matrix/identity/v2/pubkey/${_keyID}`
    )

    expect(response.statusCode).toBe(200)
    expect(response.body.public_key).toBeDefined()
    expect(response.body.public_key).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(response.body.public_key).toBe(shortKeyPair.publicKey)
  })

  it('should return 404 when incorrect keyID is given', async () => {
    const _keyID = 'incorrectKeyID'
    const response = await request(app).get(
      `/_matrix/identity/v2/pubkey/${_keyID}`
    ) // exactement '/_matrix/identity/v2/pubkey/' + _keyID

    expect(response.statusCode).toBe(404)
    expect(response.body.errcode).toBe('M_NOT_FOUND')
  })
})
