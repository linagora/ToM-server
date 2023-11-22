import IdentityServer from '@twake/matrix-identity-server'
import express from 'express'


const identityServer = new IdentityServer()
const app = express()

identityServer.ready
  .then(() => {
    Object.keys(identityServer.api.get).forEach((k) => {
      app.get(k, identityServer.api.get[k])
    })
    Object.keys(identityServer.api.post).forEach((k) => {
      app.post(k, identityServer.api.post[k])
    })
    const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
    console.log(`Listening on port ${port}`)
    app.listen(port)
  })
  .catch((e) => {
    console.error(e)
    throw e
  })