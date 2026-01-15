import FederatedIdentityService from '@twake-chat/federated-identity-service'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Set TWAKE_SERVER_CONF from command-line argument or config.json in project root
 * Priority: TWAKE_SERVER_CONF env var > --config argument > config.json in root
 */
if (process.env.TWAKE_SERVER_CONF == null) {
  const configArgIndex = process.argv.indexOf('--config')
  let configPath: string | undefined

  if (configArgIndex !== -1 && process.argv[configArgIndex + 1]) {
    const providedPath = process.argv[configArgIndex + 1]
    configPath = path.isAbsolute(providedPath)
      ? providedPath
      : path.join(process.cwd(), providedPath)

    if (!fs.existsSync(configPath)) {
      console.error(`Config file not found: ${configPath}`)
      process.exit(1)
    }
  } else {
    const defaultConfigPath = path.join(process.cwd(), 'config.json')
    if (fs.existsSync(defaultConfigPath)) {
      configPath = defaultConfigPath
    }
  }

  if (configPath) {
    process.env.TWAKE_SERVER_CONF = configPath
    console.log(`Using configuration file: ${configPath}`)
  }
}

const conf = {
  additional_features: process.env.ADDITIONAL_FEATURES === 'true',
  base_url: process.env.BASE_URL,
  cron_service: process.env.CRON_SERVICE || true,
  database_engine: process.env.DATABASE_ENGINE,
  database_host: process.env.DATABASE_HOST,
  database_name: process.env.DATABASE_NAME,
  database_user: process.env.DATABASE_USER,
  database_password: process.env.DATABASE_PASSWORD,
  database_ssl: process.env.DATABASE_SSL
    ? JSON.parse(process.env.DATABASE_SSL)
    : false,
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
  chat_url: process.env.CHAT_URL ?? 'https://chat.twake.app',
  auth_url: process.env.AUTH_URL ?? 'https://auth.example.com',
  matrix_admin_login: process.env.MATRIX_ADMIN_LOGIN ?? 'admin',
  matrix_admin_password: process.env.MATRIX_ADMIN_PASSWORD ?? 'change-me',
  admin_access_token: process.env.ADMIN_ACCESS_TOKEN ?? 'secret',
  signup_url: process.env.SIGNUP_URL ?? 'https://sign-up.twake.app/?app=chat'
}

const app = express()

const trustProxy = process.env.TRUSTED_PROXIES
  ? process.env.TRUSTED_PROXIES.split(/\s+/)
  : []
if (trustProxy.length > 0) {
  (conf as any).trust_x_forwarded_for = true
  app.set('trust proxy', trustProxy)
} else {
  app.set('trust proxy', (conf as any).trust_x_forwarded_for)
}

const federatedIdentityService = new FederatedIdentityService(conf as any)

federatedIdentityService.ready
  .then(() => {
    app.use(federatedIdentityService.routes)
    // Parse port from --port argument or environment variable
    const portArgIndex = process.argv.indexOf('--port')
    const portFromArg = portArgIndex !== -1 && process.argv[portArgIndex + 1]
      ? parseInt(process.argv[portArgIndex + 1])
      : null
    const port = portFromArg ?? (process.env.PORT ? parseInt(process.env.PORT) : 3000)
    
    console.log(`Federated Identity Server listening on port: ${port}`)
    app.listen(port, '0.0.0.0')
  })
  .catch((e) => {
    console.error(e)
    throw e
  })
