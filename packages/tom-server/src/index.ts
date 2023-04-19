import { type Config } from './utils'
import { type ConfigDescription } from '@twake/config-parser'
import { Router } from 'express'
import IdServer from './identity-server'
import VaultServer from './vault-api'

export default class TwakeServer {
  endpoints: Router
  ready: Promise<boolean>

  constructor(conf?: Partial<Config>, confDesc?: ConfigDescription) {
    this.endpoints = Router()
    const idServer = new IdServer(conf, confDesc)
    const vaultServer = new VaultServer(conf, confDesc)
    this.ready = new Promise((resolve, reject) => {
      Promise.all([idServer.ready, vaultServer.ready])
        .then(() => {
          Object.keys(idServer.api.get).forEach((k) => {
            this.endpoints.get(k, idServer.api.get[k])
          })
          Object.keys(idServer.api.post).forEach((k) => {
            this.endpoints.post(k, idServer.api.post[k])
          })
          this.endpoints.use(vaultServer.endpoints)
          resolve(true)
        })
        .catch((err) => {
          /* istanbul ignore next */
          reject(err)
        })
    })
  }
}
