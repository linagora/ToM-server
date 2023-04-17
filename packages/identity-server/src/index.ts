import MatrixIdentityServer, {
  Utils as MUtils,
  type Config as MConfig,
  defaultConfig as MdefaultConfig
} from '@twake/matrix-identity-server'
import autocompletion from './lookup/autocompletion'
import { type ConfigDescription } from '@twake/config-parser'
import Authenticate from './utils/authenticate'

export type { WhoAmIResponse } from './utils/authenticate'

export type Config = MConfig & {
  matrix_server: string
}
export type expressAppHandler = MUtils.expressAppHandler

export const defaultConfig = {
  ...MdefaultConfig,
  matrix_server: 'localhost'
}

export const Utils = MUtils

export default class TwakeIdentityServer extends MatrixIdentityServer {
  constructor(conf?: Partial<Config>, confDesc?: ConfigDescription) {
    if (confDesc == null) confDesc = defaultConfig
    super(conf, confDesc)
    this.authenticate = Authenticate(this.db, this.conf as Config)
    const superReady = this.ready
    this.ready = new Promise((resolve, reject) => {
      superReady
        .then(() => {
          // Extend API
          this.api.post['/_twake/identity/v1/lookup/match'] =
            autocompletion(this)
          resolve(true)
        })
        .catch((e) => {
          /* istanbul ignore next */
          reject(e)
        })
    })
  }
}
