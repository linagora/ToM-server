import { Utils } from '@twake/matrix-identity-server'
import { type Config, type expressAppHandler } from '../types'

class WellKnown {
  api: {
    get: Record<string, expressAppHandler>
  }

  _wellKnownClient: expressAppHandler

  constructor(conf: Config) {
    this._wellKnownClient = (req, res) => {
      Utils.send(res, 200, {
        'm.homeserver': {
          base_url: conf.matrix_server
        },
        'm.identity_server': {
          base_url: conf.base_url
        },
        't.server': {
          base_url: conf.base_url
        },
        domain: conf.server_name
      })
    }
    this.api = {
      get: {
        '/.well-known/matrix/client': this._wellKnownClient,
        '/.well-known/twake/client': this._wellKnownClient
      }
    }
  }
}

export default WellKnown
