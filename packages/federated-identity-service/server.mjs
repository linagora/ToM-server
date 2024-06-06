import FederatedIdentityService from '@twake/federated-identity-service'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const conf = {
  additional_features: process.env.ADDITIONAL_FEATURES || false,
  base_url: process.env.BASE_URL,
  cron_service: process.env.CRON_SERVICE || true,
  database_engine: process.env.DATABASE_ENGINE,
  database_host: process.env.DATABASE_HOST,
  database_name: process.env.DATABASE_NAME,
  database_user: process.env.DATABASE_USER,
  database_password: process.env.DATABASE_PASSWORD,
  hashes_rate_limit: process.env.HASHES_RATE_LIMIT,
  is_federated_identity_service: true,
  ldap_base: process.env.LDAP_BASE,
  ldap_filter: process.env.LDAP_FILTER,
  ldap_user: process.env.LDAP_USER,
  ldap_password: process.env.LDAP_PASSWORD,
  ldap_uri: process.env.LDAP_URI,
  matrix_database_engine: process.env.MATRIX_DATABASE_ENGINE,
  matrix_database_host: process.env.MATRIX_DATABASE_HOST,
  matrix_database_name: process.env.MATRIX_DATABASE_NAME,
  matrix_database_password: process.env.MATRIX_DATABASE_PASSWORD,
  matrix_database_user: process.env.MATRIX_DATABASE_USER,
  pepperCron: process.env.PEPPER_CRON || '9 1 * * *',
  server_name: process.env.SERVER_NAME,
  template_dir:
    process.env.TEMPLATE_DIR ||
    path.join(
      __dirname,
      'node_modules',
      '@twake',
      'matrix-identity-server',
      'templates'
    ),
  update_users_cron: process.env.UPDATE_USERS_CRON || '*/10 * * * *',
  userdb_engine: process.env.USERDB_ENGINE,
  userdb_host: process.env.USERDB_HOST,
  userdb_name: process.env.USERDB_NAME,
  userdb_user: process.env.USERDB_USER,
  userdb_password: process.env.USERDB_PASSWORD,
  trust_x_forwarded_for: process.env.TRUST_X_FORWARDED_FOR || false,
  trusted_servers_addresses: process.env.TRUSTED_SERVERS_ADDRESSES
}

const federatedIdentityService = new FederatedIdentityService(conf)
const app = express()
const promises = [federatedIdentityService.ready]

if (process.env.CROWDSEC_URI) {
  if (!process.env.CROWDSEC_KEY) {
    throw new Error('Missing CROWDSEC_KEY')
  }
  promises.push(
    new Promise((resolve, reject) => {
      import('@crowdsec/express-bouncer')
        .then((m) =>
          m.default({
            url: process.env.CROWDSEC_URI,
            apiKey: process.env.CROWDSEC_KEY
          })
        )
        .then((crowdsecMiddleware) => {
          app.use(crowdsecMiddleware)
          resolve()
        })
        .catch(reject)
    })
  )
}

Promise.all(promises)
  .then(() => {
    app.use(federatedIdentityService.routes)
    const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
    console.log(`Listening on port ${port}`)
    app.listen(port)
  })
  .catch((e) => {
    console.error(e)
    throw e
  })
