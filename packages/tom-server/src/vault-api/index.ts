import defaultConfDesc from '../config.json'
import { Router } from 'express'
import isAuth, { type tokenDetail } from './middlewares/auth'
import parser from './middlewares/parser'
import {
  allowCors,
  type expressAppHandler,
  type expressAppHandlerError,
  errorMiddleware
} from './utils'
import VaultDb from './db'
import {
  type VaultController,
  getRecoveryWords,
  methodNotAllowed,
  saveRecoveryWords
} from './controllers/vault'
import { type Config } from '../utils'

declare module 'express-serve-static-core' {
  interface Request {
    token: tokenDetail
  }
}

export const defaultConfig = defaultConfDesc

export default class TwakeVaultAPI {
  endpoints: Router
  vaultDb: VaultDb
  conf: Config
  ready: Promise<boolean>

  constructor(conf: Config) {
    this.conf = conf
    this.endpoints = Router()
    this.vaultDb = new VaultDb(this.conf)
    this.ready = new Promise((resolve, reject) => {
      this.vaultDb.ready
        .then(() => {
          this.endpoints
            .route('/_twake/recoveryWords')
            .get(...this._middlewares(getRecoveryWords))
            .post(...this._middlewares(saveRecoveryWords))
            .all(allowCors, methodNotAllowed, errorMiddleware)
          resolve(true)
        })
        .catch((err) => {
          /* istanbul ignore next */
          reject(err)
        })
    })
  }

  private _middlewares(
    controller: VaultController
  ): Array<expressAppHandler | expressAppHandlerError> {
    return [
      allowCors,
      ...parser,
      isAuth(this.vaultDb.db, this.conf),
      controller(this.vaultDb),
      errorMiddleware
    ]
  }
}
