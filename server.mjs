import express from 'express'
import IdServer from '@twake/identity-server'
import TwakeVaultAPI from '@twake/vault-api'
import path from 'node:path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
//const vaultApiServer = new TwakeVaultAPI()

const idServer = new IdServer({
  database_host: process.env.DATABASE_HOST,
  database_user: process.env.DATABASE_USER,
  database_password: process.env.DATABASE_PASSWORD,
  database_name: process.env.DATABASE_NAME,
  database_engine: process.env.DATABASE_ENGINE,
  ldap_base: process.env.LDAP_BASE,
  ldap_user: process.env.LDAP_USER,
  ldap_password: process.env.LDAP_PASSWORD,
  ldap_uri: process.env.LDAP_URI,
  matrix_server: process.env.MATRIX_SERVER,
  template_dir: path.join(__dirname,'packages','identity-server','templates'),
  userdb_engine: 'ldap',
})

const app = express()

//vaultApiServer.ready
//  .then(() => {
//    app.use(vaultApiServer.endpoints)
    idServer.ready
      .then(() => {
        Object.keys(idServer.api.get).forEach((k) => {
          console.log('Add GET endpoint', k)
          app.get(k, idServer.api.get[k])
        })
        Object.keys(idServer.api.post).forEach((k) => {
          console.log('Add POST endpoint', k)
          app.post(k, idServer.api.post[k])
        })
        const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
        console.log(`Listening on port ${port}`)
        app.listen(port)
      })
      .catch((e) => {
        throw e
      })
//  })
