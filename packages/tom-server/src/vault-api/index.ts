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
  saveRecoveryWords,
  deleteRecoveryWords
} from './controllers/vault'
import { type Config } from '../types'
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
      /**
       * @openapi
       * '/_twake/recoveryWords':
       *  get:
       *    tags:
       *    - Vault API
       *    description: Allow for the connected user to retrieve its recovery words
       *    responses:
       *      200:
       *        description: Success
       *        content:
       *          application/json:
       *            schema:
       *              type: object
       *              properties:
       *                words:
       *                  type: string
       *                  description: Recovery words of the connected user
       *            example:
       *              words: This is the recovery sentence of rtyler
       *      404:
       *        description: Not found
       *        content:
       *          application/json:
       *            schema:
       *              type: object
       *              properties:
       *                error:
       *                  type: string
       *                  description: Connected user has no recovery sentence
       *            example:
       *              error: User has no recovery sentence
       *      409:
       *        description: Conflict
       *        content:
       *          application/json:
       *            schema:
       *              type: object
       *              properties:
       *                error:
       *                  type: string
       *                  description: Connected user has multiple recovery sentence
       *            example:
       *              error: User has more than one recovery sentence
       *      401:
       *        $ref: '#/components/responses/Unauthorized'
       *      500:
       *        $ref: '#/components/responses/InternalServerError'
       */
      .get(...this._middlewares(getRecoveryWords))
      /**
       * @openapi
       * '/_twake/recoveryWords':
       *  post:
       *    tags:
       *    - Vault API
       *    description: Store connected user recovery words in database
       *    requestBody:
       *      description: Object containing the recovery words of the connected user
       *      required: true
       *      content:
       *        application/json:
       *          schema:
       *            type: object
       *            properties:
       *              words:
       *                type: string
       *                description: The recovery words of the connected user
       *            required:
       *              - words
       *          example:
       *            words: This is the recovery sentence of rtyler
       *    responses:
       *      200:
       *        description: Success
       *        content:
       *          application/json:
       *            schema:
       *              type: object
       *              properties:
       *                message:
       *                  type: string
       *                  description: Message indicating that words have been successfully saved
       *              example:
       *                message: Saved recovery words sucessfully
       *      401:
       *        $ref: '#/components/responses/Unauthorized'
       *      500:
       *        $ref: '#/components/responses/InternalServerError'
       */
      .post(...this._middlewares(saveRecoveryWords))
      /**
       * @openapi
       * '/_twake/recoveryWords':
       *  delete:
       *    tags:
       *    - Vault API
       *    description: Delete the user recovery words in the database
       *    responses:
       *      204:
       *        description: Delete success
       *      404:
       *        description: Not found
       *        content:
       *          application/json:
       *            schema:
       *              type: object
       *              properties:
       *                error:
       *                  type: string
       *                  description: Connected user has no recovery sentence
       *            example:
       *              error: User has no recovery sentence
       *      401:
       *        $ref: '#/components/responses/Unauthorized'
       *      500:
       *        $ref: '#/components/responses/InternalServerError'
       */
      .delete(...this._middlewares(deleteRecoveryWords))
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
