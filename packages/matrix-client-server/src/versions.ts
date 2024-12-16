import { send, type expressAppHandler } from '@twake/utils'

/* This part deals with supported versions of the matrix Protocol itself */

// TODO: fix supported versions
export const versions = [
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

/* This part deals with supported room versions */

// TODO : update the room versions to the latest supported versions

export const DEFAULT_ROOM_VERSION = 10

export const ROOM_VERSIONS = {
  1: 'stable',
  2: 'stable',
  3: 'stable',
  4: 'stable',
  5: 'stable',
  6: 'stable',
  7: 'stable',
  8: 'stable',
  9: 'stable',
  10: 'stable',
  11: 'stable'
}
