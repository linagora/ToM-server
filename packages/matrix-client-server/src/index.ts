import configParser, { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import MatrixIdentityServer from '@twake/matrix-identity-server'
import fs from 'fs'
import defaultConfig from './config.json'
import initializeDb from './db'
import { type Config } from './types'

export default class MatrixClientServer extends MatrixIdentityServer {
  constructor(
    conf?: Partial<Config>,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger
  ) {
    if (confDesc == null) confDesc = defaultConfig
    const serverConf = configParser(
      confDesc,
      /* istanbul ignore next */
      fs.existsSync('/etc/twake/client-server.conf')
        ? '/etc/twake/client-server.conf'
        : process.env.TWAKE_CLIENT_SERVER_CONF != null
        ? process.env.TWAKE_CLIENT_SERVER_CONF
        : conf != null
        ? conf
        : undefined
    ) as Config
    super(serverConf, confDesc, logger)
    this.ready = new Promise((resolve, reject) => {
      this.ready
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          return initializeDb(this.db, this.conf, this.logger)
        })
        .then(() => {
          this.api.get = { ...this.api.get }
          this.api.post = { ...this.api.post }
          resolve(true)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }
}
