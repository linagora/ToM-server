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
import { isIpLiteral, isNetwork } from './utils/ip-address'

export default class FederatedIdentityService extends MatrixIdentityServer {
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
      fs.existsSync('/etc/twake/federated-identity-service.conf')
        ? '/etc/twake/federated-identity-service.conf'
        : process.env.TWAKE_FEDERATED_IDENTITY_SERVICE_CONF != null
        ? process.env.TWAKE_FEDERATED_IDENTITY_SERVICE_CONF
        : conf != null
        ? conf
        : undefined
    ) as Config
    super(serverConf, confDesc, logger)
    this.conf.trusted_servers_addresses =
      typeof this.conf.trusted_servers_addresses === 'string'
        ? (this.conf.trusted_servers_addresses as string)
            .split(/[,\s]+/)
            .filter((addr) => {
              // istanbul ignore next
              if ((addr.match(isIpLiteral) ?? addr.match(isNetwork)) != null) {
                return true
              } else {
                this.logger.warn(`${addr} rejected`)
                return false
              }
            })
        : this.conf.trusted_servers_addresses
    this.logger.debug(
      `Trusted servers: ${this.conf.trusted_servers_addresses.join(', ')}`
    )
    this.authenticate = Authenticate(
      this.db,
      this.conf.trusted_servers_addresses,
      this.conf.trust_x_forwarded_for as boolean,
      this.logger
    )
    const superReady = this.ready
    this.ready = new Promise((resolve, reject) => {
      superReady
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return initializeDb(this.db, this.conf, this.logger)
        })
        .then(() => {
          this.routes = Routes(
            this.api,
            this.db,
            this.authenticate,
            this.conf,
            this.logger
          )
          resolve(true)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }
}
