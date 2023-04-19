// import MatrixIdentityServer, {
// defaultConfig as MdefaultConfig
// } from '@twake/matrix-identity-server'
import autocompletion from './lookup/autocompletion'
import { type ConfigDescription } from '@twake/config-parser'
import Authenticate from './utils/authenticate'
import { type Config } from '../utils'
import MatrixIdentityServer from '@twake/matrix-identity-server'
import defaultConfig from '../config.json'

export type { WhoAmIResponse } from './utils/authenticate'

export default class TwakeIdentityServer extends MatrixIdentityServer {
  declare conf: Config
  constructor(conf: Config, confDesc?: ConfigDescription) {
    if (confDesc == null) confDesc = defaultConfig
    super(conf, confDesc)
    this.authenticate = Authenticate(this.db, this.conf)
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
