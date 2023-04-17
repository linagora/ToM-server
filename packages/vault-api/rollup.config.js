import config from '../../rollup-template.js'

export default config([
  'express',
  'sqlite3',
  'node-fetch',
  '@twake/config-parser',
  '@twake/matrix-identity-server',
  '@twake/identity-server'
])
