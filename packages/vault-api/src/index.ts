import configParser from '@twake/config-parser'
import fs from 'fs'
import confDesc from './config.json'
import { Router } from 'express'
import isAuth, { type tokenDetail } from './middlewares/auth'
import parser from './middlewares/parser'
import {
  allowCors,
  type expressAppHandler,
  type expressAppHandlerError,
  type Config,
  errorMiddleware
} from './utils'
import VaultDb from './db'
import {
  type VaultController,
  getRecoveryWords,
  methodNotAllowed,
  saveRecoveryWords
} from './controllers/vault'

declare module 'express-serve-static-core' {
  interface Request {
    token: tokenDetail
  }
}

const middlewares = (
  controller: VaultController,
  vaultDb: VaultDb
): Array<expressAppHandler | expressAppHandlerError> => {
  return [
    allowCors,
    ...parser,
    isAuth(vaultDb.db),
    controller(vaultDb),
    errorMiddleware
  ]
}

export default class TwakeVaultAPI {
  endpoints: Router
  vaultDb: VaultDb
  conf: Config
  ready: Promise<boolean>

  constructor(conf?: Partial<Config>) {
    this.endpoints = Router()
    this.conf = configParser(
      confDesc,
      this._getConfigurationFile(conf)
    ) as Config
    this.vaultDb = new VaultDb(this.conf)
    this.ready = new Promise((resolve, reject) => {
      this.vaultDb.ready
        .then(() => {
          this.endpoints
            .route('/recoveryWords')
            .get(...middlewares(getRecoveryWords, this.vaultDb))
            .post(...middlewares(saveRecoveryWords, this.vaultDb))
            .all(allowCors, methodNotAllowed, errorMiddleware)
          resolve(true)
        })
        .catch((err) => {
          /* istanbul ignore next */
          reject(err)
        })
    })
  }

  private _getConfigurationFile(
    conf: Partial<Config> | undefined
  ): object | fs.PathOrFileDescriptor | undefined {
    if (conf != null) {
      return conf
    } else if (process.env.TWAKE_VAULT_SERVER_CONF != null) {
      return process.env.TWAKE_VAULT_SERVER_CONF
    } else if (fs.existsSync('/etc/twake/vault-server.conf')) {
      /* istanbul ignore next */
      return '/etc/twake/vault-server.conf'
    } else {
      return undefined
    }
  }
}
