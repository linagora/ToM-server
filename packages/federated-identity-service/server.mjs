import FederatedIdentityService from '@twake/federated-identity-service'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const conf = {
  base_url: process.env.BASE_URL,
  additional_features: process.env.ADDITIONAL_FEATURES || false,
  cron_service: process.env.CRON_SERVICE || true,
  database_engine: process.env.DATABASE_ENGINE,
  database_host: process.env.DATABASE_HOST,
  database_name: process.env.DATABASE_NAME,
  database_user: process.env.DATABASE_USER,
  database_password: process.env.DATABASE_PASSWORD,
  database_ssl: process.env.DATABASE_SSL
    ? JSON.parse(process.env.DATABASE_SSL)
    : false,
  hashes_rate_limit: process.env.HASHES_RATE_LIMIT || 100,
  rate_limiting_window: process.env.RATE_LIMITING_WINDOW || 600000,
  rate_limiting_nb_requests: process.env.RATE_LIMITING_NB_REQUESTS || 100,
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
  matrix_database_ssl: process.env.MATRIX_DATABASE_SSL
    ? JSON.parse(process.env.MATRIX_DATABASE_SSL)
    : false,
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
  userdb_engine: process.env.USERDB_ENGINE || '',
  userdb_host: process.env.USERDB_HOST,
  userdb_name: process.env.USERDB_NAME,
  userdb_user: process.env.USERDB_USER,
  userdb_password: process.env.USERDB_PASSWORD,
  userdb_ssl: process.env.USERDB_SSL
    ? JSON.parse(process.env.USERDB_SSL)
    : false,
  trust_x_forwarded_for: process.env.TRUST_X_FORWARDED_FOR || false,
  trusted_servers_addresses: process.env.TRUSTED_SERVERS_ADDRESSES,
  sms_api_key: process.env.SMS_API_KEY,
  sms_api_login: process.env.SMS_API_LOGIN,
  sms_api_url: process.env.SMS_API_URL,
  chat_url: process.env.CHAT_URL ?? 'https://chat.twake.app'
}

const app = express()

const trustProxy = process.env.TRUSTED_PROXIES
  ? process.env.TRUSTED_PROXIES.split(/\s+/)
  : []
if (trustProxy.length > 0) {
  conf.trust_x_forwarded_for = true
  app.set('trust proxy', ...trustProxy)
} else {
  app.set('trust proxy', conf.trust_x_forwarded_for)
}

const federatedIdentityService = new FederatedIdentityService(conf)
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
    app.listen(port, '0.0.0.0')
  })
  .catch((e) => {
    console.error(e)
    throw e
  })
