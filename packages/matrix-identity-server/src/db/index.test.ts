import IdDb from './index'
import { randomString } from '../utils/tokenUtils'

test('Returns a SQLite database initialized', (done) => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  const idDb = new IdDb({
    database_vacuum_delay: 36000000,
    base_url: '',
    database_engine: 'sqlite',
    database_host: '',
    server_name: '',
    smtp_server: '',
    template_dir: ''
  })
  idDb.ready.then(() => {
    idDb.serialize(() => {
      const stmt = idDb.prepare('INSERT INTO tokens VALUES(?,?)')
      if (stmt == null) {
        done('DB not ready')
      } else {
        const id = randomString(64)
        stmt.run(id, '{}')
        stmt.finalize()
        idDb.all('SELECT * FROM tokens', (_err, row) => {
          if (_err != null || row == null) {
            done('Table "tokens" not created')
          } else {
            expect(row[0].id).toEqual(id)
            expect(row[0].data).toEqual('{}')
            done()
          }
        })
      }
    })
  }).catch(e => done(e))
})
