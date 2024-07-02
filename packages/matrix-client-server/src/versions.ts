import {
  send,
  type expressAppHandler
} from '@twake/matrix-identity-server/dist/utils'

// TODO : update eventual unstable features
// const unstable_features: object = {'org.example.my_feature': true}

// TODO : update eventual limited unstable features
// const limited_unstable_features: object = {'org.example.my_feature': true}

// TODO: update supported versions
const versions: string[] = [
  // 'r0.1.0',
  // 'r0.2.0',
  // 'r0.2.1',
  // 'r0.3.0',
  'v1.1',
  'v1.2',
  'v1.3',
  'v1.4',
  'v1.5',
  'v1.6',
  'v1.7',
  'v1.8',
  'v1.9',
  'v1.10',
  'v1.11'
]

// TODO : adapt if unstable features are added
const getVersions: expressAppHandler = (req, res) => {
  send(res, 200, { versions })
}

export default getVersions
