import sqlite3 from 'sqlite3'
import fs from 'fs'
import UserDB from './index'
import defaultConfig from '../config.json'

const dbName = './test.db'

beforeAll(done => {
  const db = new sqlite3.Database(dbName)
  db.run(`CREATE TABLE users(uid varchar(64) primary key)`, (err) => {
    if (err) {
      done(err)
    } else {
      db.run(`INSERT INTO users values('dwho')`, (err) => {
        if (err) {
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
      database_host: dbName,
      database_engine: 'sqlite'
    })
    userDB.ready.then(() => {
      userDB.get('users', ['uid'], 'uid', 'dwho').then(list => {
        expect(list[0].uid).toBe('dwho')
        done()
      }).catch(e => { done(e) })
    }).catch(e => { done(e) })
  })
})
