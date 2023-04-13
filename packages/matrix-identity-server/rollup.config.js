import config from '../../rollup-template.js'

export default config([
  'express',
  'fs',
  'ldapjs',
  'node-cron',
  'querystring',
  'sqlite3',
  'pg',
  'nodemailer',
  'node-fetch',
  '@twake/config-parser',
  '@twake/crypto'
])
