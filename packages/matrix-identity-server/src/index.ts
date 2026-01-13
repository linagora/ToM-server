import configParser, { type ConfigDescription } from '@twake-chat/config-parser'
import fs from 'fs'

// Internal libraries
import defaultConfDesc from './config.json' with { type: "json" }
import CronTasks from './cron/index.ts'
import {
  errMsg as _errMsg,
  hostnameRe,
  send,
  type expressAppHandler
} from '@twake-chat/utils'
import {
  Authenticate as utilsAuthenticate,
  type AuthenticationFunction
} from './utils.ts'
import versions from './versions.ts'

// Endpoints
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake-chat/logger'
import { type Request, type Response } from 'express'
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit'
import GetValidated3pid from './3pid/index.ts'
import bind from './3pid/bind.ts'
import unbind from './3pid/unbind.ts'
import account from './account/index.ts'
import logout from './account/logout.ts'
import register from './account/register.ts'
import Cache from './cache/index.ts'
import IdentityServerDb from './db/index.ts'
import SignEd25519 from './ephemeral_signing/index.ts'
import StoreInvit from './invitation/index.ts'
import getPubkey from './keyManagement/getPubkey.ts'
import isEphemeralPubkeyValid from './keyManagement/validEphemeralPubkey.ts'
import isPubkeyValid from './keyManagement/validPubkey.ts'
import lookup from './lookup/index.ts'
import hashDetails from './lookup/hash_details.ts'
import updateHash from './lookup/updateHash.ts'
import status from './status.ts'
import Terms from './terms/index.ts'
import PostTerms from './terms/index.post.ts'
import { type Config } from './types.ts'
import UserDB from './userdb/index.ts'
import _validateMatrixToken from './utils/validateMatrixToken.ts'
import RequestToken from './validate/email/requestToken.ts'
import SubmitToken from './validate/email/submitToken.ts'
export { type tokenContent } from './account/register.ts'
export { default as updateUsers } from './cron/updateUsers.ts'
export { default as IdentityServerDb } from './db/index.ts'
export { default as createTables } from './db/sql/_createTables.ts'
export { default as Pg } from './db/sql/pg.ts'
export { default as SQLite } from './db/sql/sqlite.ts'
export { default as MatrixDB, type MatrixDBBackend } from './matrixDb/index.ts'
export * from './types.ts'
export {
  default as UserDB,
  type Collections as userDbCollections
} from './userdb/index.ts'
export * as Utils from './utils.ts'
export { default as UserDBPg } from './userdb/sql/pg.ts'
export { default as UserDBSQLite } from './userdb/sql/sqlite.ts'
export const validateMatrixToken = _validateMatrixToken
export const defaultConfig = defaultConfDesc
export const Authenticate = utilsAuthenticate

export type IdServerAPI = Record<string, expressAppHandler>

export default class MatrixIdentityServer<T extends string = never> {
  api: {
    get: IdServerAPI
    post: IdServerAPI
    put?: IdServerAPI
    delete?: IdServerAPI
  }

  db: IdentityServerDb<T>
  userDB: UserDB
  cronTasks?: CronTasks<T>
  conf: Config
  ready: Promise<boolean>
  cache?: Cache
  updateHash?: typeof updateHash
  rateLimiter: RateLimitRequestHandler

  private _authenticate!: AuthenticationFunction
  private readonly _logger: TwakeLogger

  get logger(): TwakeLogger {
    return this._logger
  }

  set authenticate(auth: AuthenticationFunction) {
    this._authenticate = (req, res, cb, requiresTerms = true) => {
      this.rateLimiter(req as Request, res as Response, () => {
        auth(req, res, cb, requiresTerms)
      })
    }
  }

  get authenticate(): AuthenticationFunction {
    return this._authenticate
  }

  constructor(
    conf?: Partial<Config>,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger,
    additionnalTables?: Record<T, string>,
    db?: IdentityServerDb<T>,
    cronAlreadyStarted: boolean = false
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
    this.conf.federated_identity_services =
      typeof this.conf.federated_identity_services === 'object'
        ? this.conf.federated_identity_services
        : typeof this.conf.federated_identity_services === 'string'
        ? (this.conf.federated_identity_services as string)
            .split(/[,\s]+/)
            .filter((addr) => addr.match(hostnameRe))
        : []
    this._convertStringtoNumberInConfig()
    this.rateLimiter = rateLimit({
      windowMs: this.conf.rate_limiting_window,
      limit: this.conf.rate_limiting_nb_requests,
      validate: {
        trustProxy: this.conf.trust_x_forwarded_for
      }
    })
    this._logger = logger ?? getLogger(this.conf as unknown as LoggerConfig)
    try {
      if (
        this.conf.hashes_rate_limit != null &&
        typeof this.conf.hashes_rate_limit !== 'number'
      ) {
        this.conf.hashes_rate_limit = parseInt(this.conf.hashes_rate_limit)
        if (Number.isNaN(this.conf.hashes_rate_limit)) {
          throw new Error(
            'hashes_rate_limit must be a number or a string representing a number'
          )
        }
      }
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      this.cache = this.conf.cache_engine ? new Cache(this.conf) : undefined
      db = this.db =
        db ?? new IdentityServerDb<T>(this.conf, this.logger, additionnalTables)
      const userDB = (this.userDB = new UserDB(
        this.conf,
        this.logger,
        this.cache
      ))
      this.authenticate = utilsAuthenticate<T>(db, this.logger)
      this.ready = new Promise((resolve, reject) => {
        Promise.all([db!.ready, userDB.ready])
          .then(() => {
            this.cronTasks = cronAlreadyStarted
              ? undefined
              : new CronTasks<T>(this.conf, db!, userDB, this.logger)
            this.updateHash = updateHash
            Promise.resolve(this.cronTasks?.ready)
              .then(() => {
                const badMethod: expressAppHandler = (req, res) => {
                  send(res, 405, _errMsg('unrecognized'))
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
                    '/_matrix/identity/v2/validate/email/requestToken':
                      badMethod,
                    '/_matrix/identity/v2/validate/email/submitToken':
                      SubmitToken(this),
                    '/_matrix/identity/v2/pubkey/isvalid': isPubkeyValid(
                      this.db
                    ),
                    '/_matrix/identity/v2/pubkey/ephemeral/isvalid':
                      isEphemeralPubkeyValid(this.db),
                    '/_matrix/identity/v2/pubkey/:keyId': getPubkey(this.db),
                    '/_matrix/identity/v2/3pid/bind': badMethod,
                    '/_matrix/identity/v2/3pid/getValidated3pid':
                      GetValidated3pid(this),
                    '/_matrix/identity/v2/3pid/unbind': badMethod,
                    '/_matrix/identity/v2/store-invite': badMethod,
                    '/_matrix/identity/v2/sign-ed25519': badMethod
                  },
                  post: {
                    '/_matrix/identity/v2': badMethod,
                    '/_matrix/identity/versions': badMethod,
                    '/_matrix/identity/v2/account': badMethod,
                    '/_matrix/identity/v2/account/register': register(
                      db!,
                      this.logger
                    ),
                    '/_matrix/identity/v2/account/logout': logout(this),
                    '/_matrix/identity/v2/lookup': lookup(this),
                    '/_matrix/identity/v2/terms': PostTerms(this),
                    '/_matrix/identity/v2/validate/email/requestToken':
                      RequestToken(this),
                    '/_matrix/identity/v2/validate/email/submitToken':
                      SubmitToken(this),
                    '/_matrix/identity/v2/pubkey/isvalid': badMethod,
                    '/_matrix/identity/v2/pubkey/ephemeral/isvalid': badMethod,
                    '/_matrix/identity/v2/pubkey/:keyId': badMethod,
                    '/_matrix/identity/v2/3pid/getValidated3pid': badMethod,
                    '/_matrix/identity/v2/3pid/bind': bind(this),
                    '/_matrix/identity/v2/3pid/unbind': unbind(this),
                    '/_matrix/identity/v2/store-invite': StoreInvit(this),
                    '/_matrix/identity/v2/sign-ed25519': SignEd25519(this)
                  }
                }
                resolve(true)
              })
              /* istanbul ignore next */
              .catch((e) => {
                console.error({ e })
                reject(e)
              })
          })
          /* istanbul ignore next */
          .catch((e) => {
            console.error({ e })
            reject(e)
          })
      })
    } catch (e) {
      console.error({ e })
      this.logger.error(e)
      this.logger.close()
      throw e
    }
  }

  private _convertStringtoNumberInConfig(): void {
    const idfieldsToConvert = [
      'rate_limiting_window',
      'rate_limiting_nb_requests'
    ] as Array<keyof Config>
    idfieldsToConvert.forEach((id) => {
      this.conf = { ...this.conf, [id]: Number(this.conf[id]) }
    })
  }

  cleanJobs(): void {
    clearTimeout(this.db?.cleanJob)
    this.cronTasks?.stop()
    this.db?.close()
    this.userDB.close()
    this.logger.close()
  }
}
