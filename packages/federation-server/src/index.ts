import configParser, { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import MatrixIdentityServer from '@twake/matrix-identity-server'
import { Router } from 'express'
import fs from 'fs'
import defaultConfig from './config.json'
import initializeDb from './db'
import { Authenticate } from './middlewares/auth'
import Routes from './routes/routes'
import { type Config } from './types'

export default class FederationServer extends MatrixIdentityServer {
  routes = Router()
  declare conf: Config
  constructor(
    conf?: Partial<Config>,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger
  ) {
    if (confDesc == null) confDesc = defaultConfig
    const serverConf = configParser(
      confDesc,
      /* istanbul ignore next */
      fs.existsSync('/etc/twake/federation-server.conf')
        ? '/etc/twake/federation-server.conf'
        : process.env.TWAKE_FEDERATION_SERVER_CONF != null
        ? process.env.TWAKE_FEDERATION_SERVER_CONF
        : conf != null
        ? conf
        : undefined
    ) as Config
    super(serverConf, confDesc, logger)
    this.conf.trusted_servers_addresses =
      process.env.TRUSTED_SERVERS_ADDRESSES?.match(/[^,"'\s[\]]+/g) ??
      this.conf.trusted_servers_addresses
    this.authenticate = Authenticate(this.db)
    const superReady = this.ready
    this.ready = new Promise((resolve, reject) => {
      superReady
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return initializeDb(this.db, this.conf, this.logger)
        })
        .then(() => {
          this.routes = Routes(this)
          resolve(true)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }
}
