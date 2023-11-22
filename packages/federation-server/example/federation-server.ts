import express from 'express'

import FederationServer from '@twake/federation-server'

const federationServer = new FederationServer({
  database_host: ':memory:'
})

const app = express()

federationServer.ready
  .then(() => {
    app.use(federationServer.routes)
    const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
    console.log(`Listening on port ${port}`)
    app.listen(port)
  })
  .catch((e) => {
    throw e
  })
