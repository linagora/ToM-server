import config from '../../rollup-template.js'

export default config([
  '@twake/matrix-identity-server',
  '@twake/logger',
  '@twake/crypto',
  '@twake/config-parser',
  'express',
  'express-validator',
  'fs'
])