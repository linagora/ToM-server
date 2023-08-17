import config from '../../rollup-template.js'

export default config([
  'express',
  'fs',
  'node-fetch',
  '@twake/config-parser',
  '@twake/matrix-identity-server',
  '@twake/matrix-application-server',
  '@twake/logger'
])
