import config from '../../rollup-template.js'

export default config([
  'express',
  'express-validator',
  'fs',
  'ldapts',
  'lodash',
  'node-fetch',
  '@twake/config-parser',
  '@twake/matrix-identity-server',
  '@twake/matrix-application-server',
  '@twake/utils',
  '@twake/logger'
])
