import { createRequestHandler } from '@remix-run/express'
import AppServer from '@twake/matrix-application-server'
import TomServer from '@twake/server'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const appServerConf = {
  base_url: process.env.BASE_URL,
  sender_localpart: process.env.SENDER_LOCALPART,
  registration_file_path: process.env.REGISTRATION_FILE_PATH,
  namespaces: process.env.NAMESPACES,
  push_ephemeral: process.env.PUSH_EPHEMERAL || true
}

const conf = {
  ...appServerConf,
  additional_features: process.env.ADDITIONAL_FEATURES || false,
  cron_service: process.env.CRON_SERVICE || true,
  database_engine: process.env.DATABASE_ENGINE,
  database_host: process.env.DATABASE_HOST,
  database_name: process.env.DATABASE_NAME,
  database_user: process.env.DATABASE_USER,
  database_ssl: process.env.DATABASE_SSL ? true : false,
  database_password: process.env.DATABASE_PASSWORD,
  federation_server: process.env.FEDERATION_SERVERS,
  is_federation_server: false,
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
  matrix_database_ssl: process.env.MATRIX_DATABASE_SSL ? true : false,
  oidc_issuer: process.env.OIDC_ISSUER,
  pepperCron: process.env.PEPPER_CRON || '9 1 * * *',
  server_name: process.env.SERVER_NAME,
  template_dir:
    process.env.TEMPLATE_DIR ||
    path.join(__dirname, 'node_modules', '@twake', 'server', 'templates'),
  update_federation_hashes_cron:
    process.env.UDPATE_FEDERATION_HASHES_CRON || '*/10 * * * *',
  update_users_cron: process.env.UPDATE_USERS_CRON || '*/10 * * * *',
  userdb_engine: 'ldap',
  enable_company_features: process.env.ENABLE_COMPANY_FEATURES || false
}

if (process.argv[2] === 'generate') {
  // eslint-disable-next-line no-unused-vars
  const appServer = new AppServer(appServerConf)
} else {
  const tomServer = new TomServer(conf)
  const app = express()

  app.use(
    '/build',
    express.static(path.join(process.cwd(), 'landing', 'public', 'build'), {
      immutable: true,
      maxAge: '1y'
    })
  )

  app.use(
    express.static(path.join(process.cwd(), 'landing', 'public'), {
      maxAge: '1h'
    })
  )

  app.get(
    '/',
    createRequestHandler({
      build: await import(
        path.join(process.cwd(), 'landing', 'build', 'index.js')
      )
    })
  )

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
}
