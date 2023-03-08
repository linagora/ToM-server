// Internal libraries
import versions from './versions'
import configParser from '@twake/config-parser'
import confDesc from './config.json'
import fs from 'fs'

// types
import { send, type expressAppHandler } from './utils'
import { errMsg } from './utils/errors'
import register from './account/register'

type IdServerAPI = Record<string, expressAppHandler>

export default class MatrixServer {
  api: {
    get: IdServerAPI
    post: IdServerAPI
    put?: IdServerAPI
  }

  conf: object

  constructor () {
    // TODO: insert here all endpoints
    this.api = {
      get: {
        '/': (req, res) => {
          send(res, 403, errMsg('forbidden'))
        },
        '/_matrix/identity/versions': versions
      },
      post: {
        '/_matrix/identity/v2/account/register': register
      }
    }
    this.conf = configParser(
      confDesc,
      /* istanbul ignore next */
      process.env.TWAKE_IDENTITY_SERVER_CONF != null
        ? process.env.TWAKE_IDENTITY_SERVER_CONF
        : fs.existsSync('/etc/twake/identity-server.conf')
          ? '/etc/twake/identity-server.conf'
          : undefined)
  }
}
