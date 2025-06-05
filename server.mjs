import { createRequestHandler } from '@remix-run/express'
import { installGlobals } from '@remix-run/node'
import AppServer from '@twake/matrix-application-server'
import TomServer from '@twake/server'
import MatrixIdentityServer from '@twake/matrix-identity-server'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'url'

installGlobals()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Parses a boolean environment variable
 *
 * @param {string} variable - The environment variable to parse
 * @param {boolean} defaultValue - The default value to use if the environment variable is not set
 * @returns {boolean} The parsed boolean value
 */
const _parseBooleanEnv = (variable, defaultValue) => {
  if (!variable) {
    return defaultValue
  }

  const val = variable.trim().toLowerCase()

  return val === 'true' || val === '1'
}

const appServerConf = {
  base_url: process.env.BASE_URL,
  sender_localpart: process.env.SENDER_LOCALPART,
  registration_file_path: process.env.REGISTRATION_FILE_PATH,
  namespaces: process.env.NAMESPACES,
  push_ephemeral: process.env.PUSH_EPHEMERAL || true
}

/**
 * Twake Chat client configuration
 *
 * @constant
 */
const twakeChatConf = {
  application_name: process.env.TCHAT_APPLICATION_NAME,
  application_welcome_message: process.env.TCHAT_APPLICATION_WELCOME_MESSAGE,
  default_homeserver: process.env.MATRIX_SERVER,
  privacy_url: process.env.TCHAT_PRIVACY_URL,
  render_html: _parseBooleanEnv(process.env.TCHAT_RENDER_HTML, false),
  hide_redacted_events: _parseBooleanEnv(
    process.env.TCHAT_HIDE_REDACTED_EVENTS,
    false
  ),
  hide_unknown_events: _parseBooleanEnv(
    process.env.TCHAT_HIDE_UNKNOWN_EVENTS,
    false
  ),
  issue_id: process.env.TCHAT_ISSUE_ID,
  registration_url: process.env.TCHAT_REGISTRATION_URL,
  twake_workplace_homeserver: process.env.TCHAT_TWAKE_WORKPLACE_HOMESERVER,
  app_grid_dashboard_available: _parseBooleanEnv(
    process.env.TCHAT_APP_GRID_DASHBOARD_AVAILABLE,
    false
  ),
  platform: process.env.TCHAT_PLATFORM,
  default_max_upload_avatar_size_in_bytes:
    process.env.TCHAT_MAX_UPLOAD_AVATAR_SIZE,
  dev_mode: _parseBooleanEnv(process.env.TCHAT_DEV_MODE, false),
  qr_code_download_url: process.env.TCHAT_QR_CODE_DOWNLOAD_URL,
  enable_logs: _parseBooleanEnv(process.env.TCHAT_ENABLE_LOGS),
  support_url: process.env.TCHAT_SUPPORT_URL,
  enable_invitations: _parseBooleanEnv(
    process.env.TCHAT_ENABLE_INVITATIONS,
    false
  )
}

let conf = {
  ...appServerConf,
  additional_features: process.env.ADDITIONAL_FEATURES || false,
  cron_service: process.env.CRON_SERVICE ?? true,
  database_engine: process.env.DATABASE_ENGINE,
  database_host: process.env.DATABASE_HOST,
  database_name: process.env.DATABASE_NAME,
  database_user: process.env.DATABASE_USER,
  database_ssl: process.env.DATABASE_SSL
    ? JSON.parse(process.env.DATABASE_SSL)
    : false,
  database_password: process.env.DATABASE_PASSWORD,
  federated_identity_services: process.env.FEDERATED_IDENTITY_SERVICES
    ? process.env.FEDERATED_IDENTITY_SERVICES.split(/[,\s]+/)
    : [],
  hashes_rate_limit: process.env.HASHES_RATE_LIMIT,
  is_federated_identity_service: false,
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
  matrix_internal_host:
    process.env.MATRIX_INTERNAL_HOST || process.env.MATRIX_SERVER,
  matrix_database_engine: process.env.MATRIX_DATABASE_ENGINE,
  matrix_database_host: process.env.MATRIX_DATABASE_HOST,
  matrix_database_name: process.env.MATRIX_DATABASE_NAME,
  matrix_database_password: process.env.MATRIX_DATABASE_PASSWORD,
  matrix_database_user: process.env.MATRIX_DATABASE_USER,
  matrix_database_ssl: process.env.MATRIX_DATABASE_SSL
    ? JSON.parse(process.env.MATRIX_DATABASE_SSL)
    : false,
  oidc_issuer: process.env.OIDC_ISSUER,
  opensearch_ca_cert_path: process.env.OPENSEARCH_CA_CERT_PATH,
  opensearch_host: process.env.OPENSEARCH_HOST,
  opensearch_is_activated: process.env.OPENSEARCH_IS_ACTIVATED || false,
  opensearch_max_retries: +process.env.OPENSEARCH_MAX_RETRIES || null,
  opensearch_number_of_shards: +process.env.OPENSEARCH_NUMBER_OF_SHARDS || null,
  opensearch_number_of_replicas:
    +process.env.OPENSEARCH_NUMBER_OF_REPLICAS || null,
  opensearch_password: process.env.OPENSEARCH_PASSWORD,
  opensearch_ssl: process.env.OPENSEARCH_SSL || false,
  opensearch_user: process.env.OPENSEARCH_USER,
  opensearch_wait_for_active_shards:
    process.env.OPENSEARCH_WAIT_FOR_ACTIVE_SHARDS,
  pepperCron: process.env.PEPPER_CRON || '9 1 * * *',
  rate_limiting_window: process.env.RATE_LIMITING_WINDOW || 600000,
  rate_limiting_nb_requests: process.env.RATE_LIMITING_NB_REQUESTS || 100,
  server_name: process.env.SERVER_NAME,
  template_dir:
    process.env.TEMPLATE_DIR ||
    path.join(__dirname, 'node_modules', '@twake', 'server', 'templates'),
  update_federated_identity_hashes_cron:
    process.env.UPDATE_FEDERATED_IDENTITY_HASHES_CRON || '*/10 * * * *',
  update_users_cron: process.env.UPDATE_USERS_CRON || '*/10 * * * *',
  userdb_engine: process.env.USERDB_ENGINE || 'ldap',
  userdb_host: process.env.USERDB_HOST,
  sms_api_key: process.env.SMS_API_KEY,
  sms_api_login: process.env.SMS_API_LOGIN,
  sms_api_url: process.env.SMS_API_URL,
  qr_code_url: process.env.QRCODE_URL ?? 'twake.chat://login',
  chat_url: process.env.CHAT_URL ?? 'https://chat.twake.app',
  auth_url: process.env.AUTH_URL ?? 'https://auth.example.com',
  matrix_admin_login: process.env.MATRIX_ADMIN_LOGIN ?? 'admin',
  matrix_admin_password: process.env.MATRIX_ADMIN_PASSWORD ?? 'change-me',
  admin_access_token: process.env.ADMIN_ACCESS_TOKEN ?? 'secret',
  signup_url: process.env.SIGNUP_URL ?? 'https://sign-up.twake.app/?app=chat',
  smtp_password: process.env.SMTP_PASSWORD,
  smtp_tls: _parseBooleanEnv(process.env.SMTP_TLS, false),
  smtp_user: process.env.SMTP_USER,
  smtp_verify_certificate: _parseBooleanEnv(
    process.env.SMTP_VERIFY_CERTIFICATE,
    false
  ),
  smtp_sender: process.env.SMTP_SENDER ?? '',
  smtp_server: process.env.SMTP_SERVER || 'localhost',
  smtp_port: process.env.SMTP_PORT || 25,
  twake_chat: twakeChatConf
}

if (process.argv[2] === 'generate') {
  // eslint-disable-next-line no-unused-vars
  const appServer = new AppServer(appServerConf)
} else {
  const app = express()

  // TODO: implement with logger debug/silly level
  //
  //app.use((req, res, next) => {
  //  console.log(req.path)
  //
  //  req.on('error', () => {
  //    console.error('ERROR:', req.path)
  //  })
  //  req.on('end', () => {
  //    console.log('END:', req.path)
  //  })
  //
  //  next()
  //})
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  const trustProxy = process.env.TRUSTED_PROXIES
    ? process.env.TRUSTED_PROXIES.split(/\s+/)
    : []
  if (trustProxy.length > 0) {
    conf.trust_x_forwarded_for = true
    app.set('trust proxy', ...trustProxy)
  }

  const tomServer = new TomServer(conf)

  const promises = [tomServer.ready]

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

  app.use(
    '/assets',
    express.static('./landing/build/client/assets', {
      immutable: true,
      maxAge: '1y'
    })
  )

  app.use(express.static('./landing/build/client', { maxAge: '1h' }))

  app.get(
    '/',
    createRequestHandler({
      build: await import('./landing/build/server/index.js')
    })
  )

  Promise.all(promises)
    .then(() => {
      const idServer = new MatrixIdentityServer(
        conf,
        undefined,
        undefined,
        undefined,
        tomServer.db,
        true
      )
      return idServer.ready.then(() => {
        app.use(tomServer.endpoints)

        // TODO: These routes should already be setup by tomServer.endpoints above
        Object.keys(idServer.api.get).forEach((k) => {
          app.get(k, idServer.api.get[k])
        })

        Object.keys(idServer.api.post).forEach((k) => {
          app.post(k, idServer.api.post[k])
        })

        const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
        console.log(`ToM-Server listening on port: ${port}`)
        app.listen(port, '0.0.0.0')
      })
    })
    .catch((e) => {
      console.error(e)
      throw e
    })
}
