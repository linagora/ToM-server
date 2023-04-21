import fs from 'fs'
import { type Config } from './utils'
import configParser, { type ConfigDescription } from '@twake/config-parser'
import { Router } from 'express'
import IdServer from './identity-server'
import VaultServer from './vault-api'
import WellKnown from './wellKnown'
import defaultConfig from './config.json'
import initializeDb, { type TwakeDB } from './db'

export default class TwakeServer {
  endpoints: Router
  ready: Promise<boolean>
  idServer: IdServer
  conf: Config
  db?: TwakeDB

  constructor(conf?: Partial<Config>, confDesc?: ConfigDescription) {
    if (confDesc == null) confDesc = defaultConfig as ConfigDescription
    this.conf = configParser(
      confDesc,
      this._getConfigurationFile(conf)
    ) as Config

    this.endpoints = Router()
    this.idServer = new IdServer(this.conf)
    const wellKnown = new WellKnown(this.idServer.conf)
    this.ready = new Promise((resolve, reject) => {
      const abort = (e: Error): void => {
        /* istanbul ignore next */
        console.error('Unable to initialize server')
        /* istanbul ignore next */
        reject(e)
      }
      this.idServer.ready
        .then(() => {
          initializeDb(this)
            .then(() => {
              const vaultServer = new VaultServer(this.conf, this)
              Object.keys(this.idServer.api.get).forEach((k) => {
                this.endpoints.get(k, this.idServer.api.get[k])
              })
              Object.keys(this.idServer.api.post).forEach((k) => {
                this.endpoints.post(k, this.idServer.api.post[k])
              })
              this.endpoints.use(vaultServer.endpoints)
              Object.keys(wellKnown.api.get).forEach((k) => {
                this.endpoints.get(k, wellKnown.api.get[k])
              })
              resolve(true)
            })
            .catch(abort)
        })
        .catch(abort)
    })
  }

  private _getConfigurationFile(
    conf: Partial<Config> | undefined
  ): object | fs.PathOrFileDescriptor | undefined {
    /* istanbul ignore else */
    if (conf != null) {
      return conf
    } else if (process.env.TWAKE_SERVER_CONF != null) {
      return process.env.TWAKE_SERVER_CONF
    } else if (fs.existsSync('/etc/twake/server.conf')) {
      /* istanbul ignore next */
      return '/etc/twake/server.conf'
    } else {
      return undefined
    }
  }

  cleanJobs(): void {
    this.idServer.cleanJobs()
  }
}
