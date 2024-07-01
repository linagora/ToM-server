import configParser, { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import fs from 'fs'
import defaultConfig from './config.json'
import { type Config } from './types'

// Internal libraries
import MatrixDBmodified from './matrixDb'
import MatrixIdentityServer from '../../matrix-identity-server/src/index'
import { type Utils } from '@twake/matrix-identity-server/'
import { errMsg } from '../../matrix-identity-server/src/utils/errors'
import { send } from '../../matrix-identity-server/src/utils'

// Endpoints

export default class MatrixClientServer extends MatrixIdentityServer {
  api: {
    get: Record<string, Utils.expressAppHandler>
    post: Record<string, Utils.expressAppHandler>
    put: Record<string, Utils.expressAppHandler>
  }

  matrixDb: MatrixDBmodified

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
    this.api = { get: {}, post: {}, put: {} }
    this.matrixDb = new MatrixDBmodified(serverConf, this.logger)
    this.ready = new Promise((resolve, reject) => {
      this.ready
        .then(() => {
          const badMethod: Utils.expressAppHandler = (req, res) => {
            send(res, 405, errMsg('unrecognized'))
          }
          this.api.get = {
            ...this.api.get
          }
          this.api.post = {
            ...this.api.post
          }
          this.api.put = {
            ...this.api.put
          }
          resolve(true)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }

  cleanJobs(): void {
    clearTimeout(this.db?.cleanJob)
    this.cronTasks?.stop()
    this.db?.close()
    this.userDB.close()
    this.logger.close()
    this.matrixDb.close()
  }
}
