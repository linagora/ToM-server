import config from '../../rollup-template.js'

export default config([
  'express',
  'sqlite3',
  'body-parser',
  '@twake/config-parser',
  '@twake/matrix-identity-server'
])
