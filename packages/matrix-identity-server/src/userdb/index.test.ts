import sqlite3 from 'sqlite3'
import fs from 'fs'
import UserDB from './index'
import defaultConfig from '../config.json'
import Cache from '../cache'
import { type Config } from '../types'

const dbName = './testldap.db'

beforeAll((done) => {
  const db = new sqlite3.Database(dbName)
  db.run('CREATE TABLE users(uid varchar(64) primary key)', (err) => {
    if (err != null) {
      done(err)
    } else {
      db.run("INSERT INTO users values('dwho')", (err) => {
        if (err != null) {
          done(err)
        } else {
          done()
        }
      })
    }
  })
})

afterAll(() => {
  fs.unlinkSync(dbName)
})

describe('UserDB', () => {
  it('should find user', (done) => {
    const userDB = new UserDB({
      ...defaultConfig,
      userdb_engine: 'sqlite',
      userdb_host: dbName,
      database_host: dbName,
      database_engine: 'sqlite'
    })
    userDB.ready
      .then(() => {
        userDB
          .get('users', ['uid'], { uid: 'dwho' })
          .then((list) => {
            expect(list[0].uid).toBe('dwho')
            done()
          })
          .catch((e) => {
            done(e)
          })
      })
      .catch(done)
  })

  it('should provide match', (done) => {
    const userDB = new UserDB({
      ...defaultConfig,
      userdb_engine: 'sqlite',
      userdb_host: dbName,
      database_host: dbName,
      database_engine: 'sqlite'
    })
    userDB.ready
      .then(() => {
        userDB
          .match('users', ['uid'], ['uid'], 'wh')
          .then((list) => {
            expect(list[0].uid).toBe('dwho')
            done()
          })
          .catch((e) => {
            done(e)
          })
      })
      .catch(done)
  })

  it('should work with cache', (done) => {
    const conf: Config = {
      ...defaultConfig,
      cache_engine: 'memory',
      userdb_engine: 'sqlite',
      userdb_host: dbName,
      database_host: dbName,
      database_engine: 'sqlite'
    }
    const userDB = new UserDB(conf, new Cache(conf))
    userDB.ready
      .then(() => {
        userDB
          .getAll('users', ['uid'], 'uid')
          .then((list) => {
            expect(list).toEqual([{ uid: 'dwho' }])
            userDB
              .getAll('users', ['uid'], 'uid')
              .then((list2) => {
                expect(list2).toEqual([{ uid: 'dwho' }])
                done()
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })
})
