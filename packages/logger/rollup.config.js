import config from '../../rollup-template.js'

export default config([
  'fs',
  'logform',
  'path',
  '@twake/config-parser',
  'winston',
  'winston-daily-rotate-file',
  'winston/lib/winston/transports'
])
