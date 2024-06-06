import express from 'express'

import FederatedIdentityService from '@twake/federated-identity-service'

const federatedIdentityService = new FederatedIdentityService({
  database_host: ':memory:'
})

const app = express()

federatedIdentityService.ready
  .then(() => {
    app.use(federatedIdentityService.routes)
    const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
    console.log(`Listening on port ${port}`)
    app.listen(port)
  })
  .catch((e) => {
    throw e
  })
