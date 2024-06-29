import configParser, { type ConfigDescription } from '@twake/config-parser'
import fs from 'fs'

// Internal libraries
import defaultConfDesc from './config.json'
import CronTasks from './cron'
import {
  Authenticate,
  hostnameRe,
  send,
  type AuthenticationFunction,
  type expressAppHandler
} from './utils'
import { errMsg as _errMsg } from './utils/errors'
import versions from './versions'

// Endpoints
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import { type Request, type Response } from 'express'
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit'
import GetValidated3pid from './3pid'
import bind from './3pid/bind'
import unbind from './3pid/unbind'
import account from './account'
import logout from './account/logout'
import register from './account/register'
import Cache from './cache'
import IdentityServerDb from './db'
import SignEd25519 from './ephemeral_signing'
import StoreInvit from './invitation'
import getPubkey from './keyManagement/getPubkey'
import isEphemeralPubkeyValid from './keyManagement/validEphemeralPubkey'
import isPubkeyValid from './keyManagement/validPubkey'
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

export default class MatrixIdentityServer<T extends string = never> {
  api: {
    get: IdServerAPI
    post: IdServerAPI
    put?: IdServerAPI
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
    additionnalTables?: Record<T, string>
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
      const db = (this.db = new IdentityServerDb<T>(
        this.conf,
        this.logger,
        additionnalTables
      ))
      const userDB = (this.userDB = new UserDB(
        this.conf,
        this.logger,
        this.cache
      ))
      this.authenticate = Authenticate<T>(db, this.logger)
      this.ready = new Promise((resolve, reject) => {
        Promise.all([db.ready, userDB.ready])
          .then(() => {
            this.cronTasks = new CronTasks<T>(
              this.conf,
              db,
              userDB,
              this.logger
            )
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
                      db,
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
              .catch(reject)
          })
          /* istanbul ignore next */
          .catch(reject)
      })
    } catch (e) {
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
