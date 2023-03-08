import idDb from './index'

test('Returns a SQLite database', (done) => {
  idDb({
    host: ":memory:",
    type: 'sqlite'
  }).then(db=>{
    db.serialize(() => {
      db.run("CREATE TABLE lorem (info TEXT)")
      const stmt = db.prepare("INSERT INTO lorem VALUES (?)")
      stmt.run("Ipsum")
      stmt.finalize()
      db.each("SELECT rowid AS id, info FROM lorem", (err, row) => {
        expect(row.id).toBe(1)
        expect(row.info).toBe('Ipsum')
        done()
      })
    })
  })
})

test('Only known db', async () => {
  await expect(
    idDb({
      host: ":memory:",
      // @ts-ignore: this is the error
      type: 'unknown'
    })
  ).rejects.toThrow()
})
