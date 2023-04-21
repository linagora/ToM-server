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
import {
  type VaultController,
  getRecoveryWords,
  methodNotAllowed,
  saveRecoveryWords
} from './controllers/vault'
import { type Config } from '../utils'
import { type TwakeDB } from '../db'
import type TwakeServer from '..'

declare module 'express-serve-static-core' {
  interface Request {
    token: tokenDetail
  }
}

export const defaultConfig = defaultConfDesc

export default class TwakeVaultAPI {
  endpoints: Router
  vaultDb: TwakeDB
  conf: Config

  constructor(conf: Config, server: TwakeServer) {
    this.conf = conf
    this.endpoints = Router()
    this.vaultDb = server.db as TwakeDB
    this.endpoints
      .route('/_twake/recoveryWords')
      .get(...this._middlewares(getRecoveryWords))
      .post(...this._middlewares(saveRecoveryWords))
      .all(allowCors, methodNotAllowed, errorMiddleware)
  }

  private _middlewares(
    controller: VaultController
  ): Array<expressAppHandler | expressAppHandlerError> {
    return [
      allowCors,
      ...parser,
      isAuth(this.vaultDb, this.conf),
      controller(this.vaultDb),
      errorMiddleware
    ]
  }
}
