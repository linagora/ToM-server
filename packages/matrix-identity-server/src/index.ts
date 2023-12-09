import configParser, { type ConfigDescription } from '@twake/config-parser'
import fs from 'fs'

// Internal libraries
import defaultConfDesc from './config.json'
import CronTasks from './cron'
import {
  Authenticate,
  send,
  type AuthenticationFunction,
  type expressAppHandler,
  hostnameRe
} from './utils'
import { errMsg as _errMsg } from './utils/errors'
import versions from './versions'

// Endpoints
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import account from './account'
import logout from './account/logout'
import register from './account/register'
import Cache from './cache'
import IdentityServerDb from './db'
import lookup from './lookup'
import hashDetails from './lookup/hash_details'
import updateHash from './lookup/updateHash'
import status from './status'
import Terms from './terms'
import PostTerms from './terms/index.post'
import { type Config } from './types'
import UserDB from './userdb'
import _validateMatrixToken from './utils/validateMatrixToken'
import RequestToken from './validate/email/requestToken'
import SubmitToken from './validate/email/submitToken'

export { type tokenContent } from './account/register'
export { default as updateUsers } from './cron/updateUsers'
export * as IdentityServerDb from './db'
export { default as createTables } from './db/sql/_createTables'
export { default as Pg } from './db/sql/pg'
export * as SQLite from './db/sql/sqlite'
export { default as MatrixDB, type MatrixDBBackend } from './matrixDb'
export * from './types'
export {
  default as UserDB,
  type Collections as userDbCollections
} from './userdb'
export * as Utils from './utils'
export * as MatrixErrors from './utils/errors'
export const errMsg = _errMsg
export const validateMatrixToken = _validateMatrixToken
export const defaultConfig = defaultConfDesc

export type IdServerAPI = Record<string, expressAppHandler>

export default class MatrixIdentityServer {
  api: {
    get: IdServerAPI
    post: IdServerAPI
    put?: IdServerAPI
  }

  db: IdentityServerDb
  userDB: UserDB
  cronTasks?: CronTasks
  conf: Config
  ready: Promise<boolean>
  cache?: Cache
  updateHash?: typeof updateHash

  authenticate: AuthenticationFunction
  private readonly _logger: TwakeLogger

  get logger(): TwakeLogger {
    return this._logger
  }

  constructor(
    conf?: Partial<Config>,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger
  ) {
    this.api = { get: {}, post: {} }
    if (confDesc == null) confDesc = defaultConfDesc
    this.conf = configParser(
      confDesc,
      /* istanbul ignore next */
      conf != null
        ? conf
        : process.env.TWAKE_IDENTITY_SERVER_CONF != null
        ? process.env.TWAKE_IDENTITY_SERVER_CONF
        : fs.existsSync('/etc/twake/identity-server.conf')
        ? '/etc/twake/identity-server.conf'
        : undefined
    ) as Config
    this.conf.federation_servers =
      typeof this.conf.federation_servers === 'string'
        ? (this.conf.federation_servers as string)
            .split(/[,\s]+/)
            .filter((addr) => addr.match(hostnameRe))
        : this.conf.federation_servers || []
    this._logger = logger ?? getLogger(this.conf as unknown as LoggerConfig)
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    this.cache = this.conf.cache_engine ? new Cache(this.conf) : undefined
    const db = (this.db = new IdentityServerDb(this.conf, this.logger))
    const userDB = (this.userDB = new UserDB(
      this.conf,
      this.cache,
      this.logger
    ))
    this.authenticate = Authenticate(db)
    this.ready = new Promise((resolve, reject) => {
      Promise.all([db.ready, userDB.ready])
        .then(() => {
          this.cronTasks = new CronTasks(this.conf, db, userDB, this._logger)
          this.updateHash = updateHash
          this.cronTasks.ready
            .then(() => {
              const badMethod: expressAppHandler = (req, res) => {
                send(res, 405, errMsg('unrecognized'))
              }
              // TODO
              // const badEndPoint: expressAppHandler = (req, res) => {
              //   send(res, 404, errMsg('unrecognized'))
              // }
              this.api = {
                get: {
                  '/_matrix/identity/v2': status,
                  '/_matrix/identity/versions': versions,
                  '/_matrix/identity/v2/account': account(this),
                  '/_matrix/identity/v2/account/register': badMethod,
                  '/_matrix/identity/v2/account/logout': badMethod,
                  '/_matrix/identity/v2/hash_details': hashDetails(this),
                  '/_matrix/identity/v2/terms': Terms(this.conf, this.logger),
                  '/_matrix/identity/v2/validate/email/requestToken': badMethod,
                  '/_matrix/identity/v2/validate/email/submitToken':
                    SubmitToken(this)
                },
                post: {
                  '/_matrix/identity/v2': badMethod,
                  '/_matrix/identity/versions': badMethod,
                  '/_matrix/identity/v2/account': badMethod,
                  '/_matrix/identity/v2/account/register': register(
                    db,
                    this.logger
                  ),
                  '/_matrix/identity/v2/account/logout': logout(this),
                  '/_matrix/identity/v2/lookup': lookup(this),
                  '/_matrix/identity/v2/terms': PostTerms(this),
                  '/_matrix/identity/v2/validate/email/requestToken':
                    RequestToken(this),
                  '/_matrix/identity/v2/validate/email/submitToken':
                    SubmitToken(this)
                }
              }
              resolve(true)
            })
            /* istanbul ignore next */
            .catch(reject)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }

  cleanJobs(): void {
    clearTimeout(this.db?.cleanJob)
    this.cronTasks?.stop()
    this.db?.close()
  }
}
