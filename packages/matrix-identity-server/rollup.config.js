import config from '../../rollup-template.js'

export default config([
  'express',
  'fs',
  'ldapjs',
  'node-cron',
  'querystring',
  'sqlite3',
  'pg',
  'node-fetch',
  'nodemailer',
  '@twake/config-parser',
  '@twake/crypto'
])
