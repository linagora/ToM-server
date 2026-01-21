import { getLogger, type TwakeLogger } from '@twake-chat/logger'
import { generateKeyPair } from '@twake-chat/crypto'
import fs from 'fs'
import defaultConfig from '../config.json' with { type: "json" }
import IdentityServerDB from '../db/index.ts'
import { type Config } from '../types.ts'
import updateKey from './updateKey.ts'

const conf: Config = {
  ...defaultConfig,
  database_engine: 'sqlite',
  database_host: ':memory:',
  userdb_engine: 'sqlite',
  userdb_host: './src/__testData__/key.db',
  server_name: 'company.com'
}

const logger: TwakeLogger = getLogger()

describe('updateHashes', () => {
  let db: IdentityServerDB
  let currentKey: { publicKey: string; privateKey: string; keyId: string }
  let previousKey: { publicKey: string; privateKey: string; keyId: string }

  beforeAll((done) => {
    db = new IdentityServerDB(conf, logger)
    db.ready
      .then(() => {
        currentKey = generateKeyPair('ed25519')
        previousKey = generateKeyPair('ed25519')
        db.insert('longTermKeypairs', {
          name: 'currentKey',
          keyID: currentKey.keyId,
          public: currentKey.publicKey,
          private: currentKey.privateKey
        })
          .then(() => {
            db.insert('longTermKeypairs', {
              name: 'previousKey',
              keyID: previousKey.keyId,
              public: previousKey.publicKey,
              private: previousKey.privateKey
            })
              .then(() => {
                done()
              })
              .catch((e) => {
                done(e)
              })
          })
          .catch((e) => {
            done(e)
          })
      })
      .catch((e) => {
        done(e)
      })
  })

  afterAll(() => {
    clearTimeout(db.cleanJob)
    if (fs.existsSync('./src/__testData__/key.db')) {
      fs.unlinkSync('./src/__testData__/key.db')
    }
    db.close()
    logger.close()
  })

  it('should be able to generate new key and update concerned fields', (done) => {
    updateKey(db, logger).catch((e) => {
      done(e)
    })
    setTimeout(() => {
      db.get('longTermKeypairs', ['keyID', 'public', 'private'], {
        name: 'currentKey'
      })
        .then((currentKeyRows) => {
          expect(currentKeyRows.length).toEqual(1)
          expect(currentKeyRows[0].keyID).not.toEqual(undefined)
          expect(currentKeyRows[0].public).not.toEqual(undefined)
          expect(currentKeyRows[0].private).not.toEqual(undefined)
          db.get('longTermKeypairs', ['keyID', 'public', 'private'], {
            name: 'previousKey'
          })
            .then((previousKeyRows) => {
              expect(previousKeyRows.length).toEqual(1)
              expect(previousKeyRows[0].keyID).toEqual(currentKey.keyId)
              expect(previousKeyRows[0].public).toEqual(currentKey.publicKey)
              expect(previousKeyRows[0].private).toEqual(currentKey.privateKey)
              done()
            })
            .catch((e) => {
              done(e)
            })
        })
        .catch((e) => {
          done(e)
        })
    }, 1000)
  })
})
