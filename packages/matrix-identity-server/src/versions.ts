import { send, type expressAppHandler } from '@twake/utils'

// TODO: fix supported versions
const versions = [
  // 'r0.1.0',
  // 'r0.2.0',
  // 'r0.2.1',
  // 'r0.3.0',
  'v1.1',
  'v1.2',
  'v1.3',
  'v1.4',
  'v1.5',
  'v1.6'
]

const getVersions: expressAppHandler = (req, res) => {
  send(res, 200, { versions })
}

export default getVersions
