import express from 'express'

import ClientServer from '@twake/matrix-client-server'

const clientServer = new ClientServer({
  database_host: ':memory:'
})

const app = express()

clientServer.ready
  .then(() => {
    Object.keys(clientServer.api.get).forEach((k) => {
      app.get(k, clientServer.api.get[k])
    })
    Object.keys(clientServer.api.post).forEach((k) => {
      app.post(k, clientServer.api.post[k])
    })
    const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
    console.log(`Listening on port ${port}`)
    app.listen(port)
  })
  .catch((e) => {
    throw e
  })
