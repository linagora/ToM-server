import IdDb from './index'
import { randomString } from '../utils/tokenUtils'
import fs from 'fs'
import { type Config } from '..'

afterEach(() => {
  fs.unlinkSync('./test.db')
})

const baseConf: Config = {
  database_vacuum_delay: 36000000,
  base_url: '',
  database_engine: 'sqlite',
  database_host: './test.db',
  mail_link_delay: 7200,
  server_name: '',
  smtp_server: '',
  template_dir: ''
}

describe('Id Server DB', () => {
  it('should a SQLite database initialized', (done) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    const idDb = new IdDb(baseConf)
    idDb.ready.then(() => {
      const id = randomString(64)
      idDb.insert('tokens', [id, '{}']).then(() => {
        idDb.get('tokens', 'id', id).then(rows => {
          expect(rows.length).toBe(1)
          expect(rows[0].id).toEqual(id)
          expect(rows[0].data).toEqual('{}')
          clearTimeout(idDb.cleanJob)
          done()
        }).catch(e => done(e))
      }).catch(e => done(e))
    }).catch(e => done(e))
  })

  it('should provide one-time-token', (done) => {
    const idDb = new IdDb(baseConf)
    idDb.ready.then(() => {
      const token = idDb.createOneTimeToken({ a: 1 })
      expect(token).toMatch(/^[a-zA-Z0-9]+$/)
      idDb.verifyOneTimeToken(token).then(data => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore
        expect(data.a).toEqual(1)
        idDb.verifyOneTimeToken(token).then(data => {
          done("Souldn't have find a value")
        }).catch(e => {
          clearTimeout(idDb.cleanJob)
          done()
        })
      }).catch(e => done(e))
    }).catch(e => done(e))
  })
})

test('OneTimeToken timeout', (done) => {
  const idDb = new IdDb({ ...baseConf, database_vacuum_delay: 1000 })
  idDb.ready.then(() => {
    const token = idDb.createOneTimeToken({ a: 1 }, 10)
    setTimeout(() => {
      idDb.verifyOneTimeToken(token).then((data) => {
        done('Should throw')
      }).catch(e => {
        clearTimeout(idDb.cleanJob)
        done()
      })
    }, 1500)
  }).catch(e => {
    done(e)
  })
})
