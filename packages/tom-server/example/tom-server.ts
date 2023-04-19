import express from 'express'

import TwakeServer from '@twake/server'

const twakeServer = new TwakeServer({
  database_host: ':memory:'
})

const app = express()

twakeServer.ready
  .then(() => {
    app.use(twakeServer.endpoints)
    const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
    console.log(`Listening on port ${port}`)
    app.listen(port)
  })
  .catch((e) => {
    throw e
  })
