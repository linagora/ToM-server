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
import MatrixIdentityServer from '@twake/matrix-identity-server'
import UiAuthenticate, {
  type UiAuthFunction
} from './utils/userInteractiveAuthentication'
import { errMsg, send, type expressAppHandler } from '@twake/utils'
import Authenticate from './utils/authenticate'

// Endpoints
import {
  getProfile,
  getAvatarUrl,
  getDisplayname
} from './profiles/getProfiles'
import { changeAvatarUrl, changeDisplayname } from './profiles/changeProfiles'
import whoami from './account/whoami'
import whois from './admin/whois'
import accountDataType from './user/account_data'
import register from './register'

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
    return this._uiauthenticate
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
    this.authenticate = Authenticate(this.matrixDb, this.logger)
    this.ready = new Promise((resolve, reject) => {
      this.ready
        .then(() => {
          const badMethod: expressAppHandler = (req, res) => {
            send(res, 405, errMsg('unrecognized'))
          }
          this.api.get = {
            '/_matrix/client/v3/account/whoami': whoami(this),
            '/_matrix/client/v3/admin/whois': whois(this),
            '/_matrix/client/v3/user/:userId/account_data/:type':
              accountDataType(this),
            '/_matrix/client/v3/register': badMethod,
            '/_matrix/client/v3/profile/:userId': getProfile(
              this.matrixDb,
              this.logger
            ),
            '/_matrix/client/v3/profile/:userId/avatar_url': getAvatarUrl(
              this.matrixDb,
              this.logger
            ),
            '/_matrix/client/v3/profile/:userId/displayname': getDisplayname(
              this.matrixDb,
              this.logger
            )
          }
          this.api.post = {
            '/_matrix/client/v3/account/whoami': badMethod,
            '/_matrix/client/v3/admin/whois': badMethod,
            '/_matrix/client/v3/register': register(this),
            '/_matrix/client/v3/profile/:userId': badMethod,
            '/_matrix/client/v3/profile/:userId/avatar_url': badMethod,
            '/_matrix/client/v3/profile/:userId/displayname': badMethod,
            '/_matrix/client/v3/user/:userId/account_data/:type': badMethod
          }
          this.api.put = {
            '/_matrix/client/v3/account/whoami': badMethod,
            '/_matrix/client/v3/admin/whois': badMethod,
            '/_matrix/client/v3/register': badMethod,
            '/_matrix/client/v3/profile/:userId': badMethod,
            '/_matrix/client/v3/profile/:userId/avatar_url': badMethod,
            '/_matrix/client/v3/profile/:userId/displayname': badMethod,
            '/_matrix/client/v3/user/:userId/account_data/:type':
              accountDataType(this)
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
