import configParser, { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import fs from 'fs'
import defaultConfig from './config.json'
import {
  type clientDbCollections,
  type ClientServerDb,
  type Config
} from './types'
import { type Request, type Response } from 'express'

// Internal libraries
import MatrixDBmodified from './matrixDb'
import MatrixIdentityServer from '../../matrix-identity-server/src/index'
import UiAuthenticate, {
  type UiAuthFunction
} from './utils/userInteractiveAuthentication'
import { type expressAppHandler } from '@twake/matrix-identity-server/src/utils'

// Endpoints

const tables = {
  ui_auth_sessions: 'session_id TEXT NOT NULL, stage_type TEXT NOT NULL'
}

export default class MatrixClientServer extends MatrixIdentityServer<clientDbCollections> {
  api: {
    get: Record<string, expressAppHandler>
    post: Record<string, expressAppHandler>
    put: Record<string, expressAppHandler>
  }

  matrixDb: MatrixDBmodified
  declare conf: Config
  declare db: ClientServerDb
  private _uiauthenticate!: UiAuthFunction

  set uiauthenticate(uiauthenticate: UiAuthFunction) {
    this._uiauthenticate = (req, res, cb) => {
      this.rateLimiter(req as Request, res as Response, () => {
        uiauthenticate(req, res, cb)
      })
    }
  }

  get uiauthenticate(): UiAuthFunction {
    return this.uiauthenticate
  }

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
    super(serverConf, confDesc, logger, tables)
    this.api = { get: {}, post: {}, put: {} }
    this.matrixDb = new MatrixDBmodified(serverConf, this.logger)
    this.uiauthenticate = UiAuthenticate(
      this.db,
      this.matrixDb,
      serverConf,
      this.logger
    )
    this.ready = new Promise((resolve, reject) => {
      this.ready
        .then(() => {
          this.api.get = { ...this.api.get }
          this.api.post = { ...this.api.post }
          this.api.put = { ...this.api.put }
          this.api.put = { ...this.api.put }
          resolve(true)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }
}
