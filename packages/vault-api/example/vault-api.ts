import express from 'express'

import TwakeVaultAPI from '@twake/vault-api'

const vaultApiServer = new TwakeVaultAPI({
  database_host: ':memory:'
})

const app = express()

vaultApiServer.ready
  .then(() => {
    app.use(vaultApiServer.endpoints)
    const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
    console.log(`Listening on port ${port}`)
    app.listen(port)
  })
  .catch((e) => {
    throw e
  })
