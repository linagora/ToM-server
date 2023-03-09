import idDb from './index'
import { randomString } from '../utils/tokenUtils'

test('Returns a SQLite database initialized', (done) => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  idDb({
    host: ':memory:',
    type: 'sqlite'
  }).then(db => {
    db.serialize(() => {
      const stmt = db.prepare('INSERT INTO tokens VALUES(?,?)')
      const id = randomString(64)
      stmt.run(id, '{}')
      stmt.finalize()
      db.each('SELECT * FROM tokens', (_err, row) => {
        expect(row.id).toEqual(id)
        expect(row.data).toEqual('{}')
        done()
      })
    })
  })
})

test('Throws on unknown db', async () => {
  await expect(
    idDb({
      host: ':memory:',
      // @ts-expect-error this is the error
      type: 'unknown'
    })
  ).rejects.toThrow()
})
