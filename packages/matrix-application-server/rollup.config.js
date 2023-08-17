import config from '../../rollup-template.js'

export default config([
  'fs',
  'express',
  '@twake/config-parser',
  '@twake/crypto',
  '@twake/logger',
  'events',
  'express-validator',
  'js-yaml'
])
