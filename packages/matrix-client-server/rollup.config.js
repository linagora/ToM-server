import config from '../../rollup-template.js'

export default config([
  '@twake/config-parser',
  '@twake/logger',
  '@twake/matrix-identity-server',
  'fs'
])
