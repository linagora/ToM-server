import { Utils } from '@twake/matrix-identity-server'
import { type Config, type expressAppHandler } from '../types'

interface WellKnownType {
  'm.homeserver': {
    base_url: string
  }
  'm.identity_server': {
    base_url: string
  }
  't.server': {
    base_url: string
  }
  'm.integrations': {
    jitsi: {
      preferredDomain: string
      baseUrl: string
      useJwt: boolean
      jwt?: {
        algorithm: string
        secret: string
        issuer: string
      }
    }
  }
  domain: string
}

class WellKnown {
  api: {
    get: Record<string, expressAppHandler>
  }

  _wellKnownClient: expressAppHandler

  constructor(conf: Config) {
    this._wellKnownClient = (req, res) => {
      const wellKnown: WellKnownType = {
        'm.homeserver': {
          base_url: conf.matrix_server
        },
        'm.identity_server': {
          base_url: conf.base_url
        },
        't.server': {
          base_url: conf.base_url
        },
        'm.integrations': {
          jitsi: {
            preferredDomain: conf.jitsiPreferredDomain,
            baseUrl: conf.jitsiBaseUrl,
            useJwt: conf.jitsiUseJwt
          }
        },
        domain: conf.server_name
      }
      /* istanbul ignore if */ // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (conf.jitsiUseJwt) {
        wellKnown['m.integrations'].jitsi.jwt = {
          algorithm: conf.jitsiJwtAlgorithm,
          secret: conf.jitsiJwtSecret,
          issuer: conf.jitsiJwtIssuer
        }
      }
      Utils.send(res, 200, wellKnown)
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
