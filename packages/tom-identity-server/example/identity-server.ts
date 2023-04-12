import express from 'express'

import IdServer from '@twake/identity-server'

const idServer = new IdServer({
  database_host: ':memory:'
})

const app = express()

idServer.ready.then(() => {
  Object.keys(idServer.api.get).forEach(k => {
    app.get(k, idServer.api.get[k])
  })
  Object.keys(idServer.api.post).forEach(k => {
    app.post(k, idServer.api.post[k])
  })
  const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
  console.log(`Listening on port ${port}`)
  app.listen(port)
}).catch(e => { throw e })
