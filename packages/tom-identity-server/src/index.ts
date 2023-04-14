import MatrixIdentityServer, {
  type Config as MConfig
} from '@twake/matrix-identity-server'

export type Config = MConfig

export default class TwakeIdentityServer extends MatrixIdentityServer {
  constructor(conf?: Partial<Config>) {
    super(conf)
    const superReady = this.ready
    this.ready = new Promise((resolve, reject) => {
      superReady
        .then(() => {
          // Extend API
          resolve(true)
        })
        .catch((e) => {
          /* istanbul ignore next */
          reject(e)
        })
    })
  }
}
