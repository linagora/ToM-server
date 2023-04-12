import MatrixIdentityServer, { type Config as MConfig } from '@twake/matrix-identity-server'

export type Config = MConfig

export default class TwakeIdentityServer extends MatrixIdentityServer {
  constructor (conf?: Partial<Config>) {
    super(conf)
    // const superReady = this.ready
    // console.error('DEBUG 1')
    // this.ready = new Promise((resolve, reject) => {
    //   superReady.then(() => {
    //     console.error('DEBUG 2')
    //     resolve(true)
    //     // Extend API
    //   }).catch(e => {
    //     /* istanbul ignore next */
    //     reject(e)
    //   })
    // })
  }
}
