import express from 'express'
import TomServer from '@twake/server'
import path from 'node:path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const conf = {
  base_url: process.env.BASE_URL,
  cron_service: process.env.CRON_SERVICE ?? true,
  database_engine: process.env.DATABASE_ENGINE,
  database_host: process.env.DATABASE_HOST,
  database_name: process.env.DATABASE_NAME,
  database_user: process.env.DATABASE_USER,
  database_password: process.env.DATABASE_PASSWORD,
  jitsiBaseUrl: process.env.JITSI_BASE_URL,
  jitsiJwtAlgorithm: process.env.JITSI_JWT_ALGORITHM,
  jitsiJwtIssuer: process.env.JITSI_JWT_ISSUER,
  jitsiJwtSecret: process.env.JITSI_SECRET,
  jitsiPreferredDomain: process.env.JITSI_PREFERRED_DOMAIN,
  jitsiUseJwt: Boolean(process.env.JITSI_USE_JWT),
  ldap_base: process.env.LDAP_BASE,
  ldap_filter: process.env.LDAP_FILTER,
  ldap_user: process.env.LDAP_USER,
  ldap_password: process.env.LDAP_PASSWORD,
  ldap_uri: process.env.LDAP_URI,
  matrix_server: process.env.MATRIX_SERVER,
  matrix_database_engine: process.env.MATRIX_DATABASE_ENGINE,
  matrix_database_host: process.env.MATRIX_DATABASE_HOST,
  matrix_database_name: process.env.MATRIX_DATABASE_NAME,
  matrix_database_password: process.env.MATRIX_DATABASE_PASSWORD,
  matrix_database_user: process.env.MATRIX_DATABASE_USER,
  oidc_issuer: process.env.OIDC_ISSUER,
  server_name: process.env.SERVER_NAME,
  template_dir:
    process.env.TEMPLATE_DIR ??
    path.join(__dirname, 'node_modules', '@twake', 'server', 'templates'),
  userdb_engine: 'ldap'
}
const tomServer = new TomServer(conf)

const app = express()

tomServer.ready
  .then(() => {
    app.use(tomServer.endpoints)
    const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
    console.log(`Listening on port ${port}`)
    app.listen(port)
  })
  .catch((e) => {
    throw e
  })
