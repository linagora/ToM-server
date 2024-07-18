import { Router } from 'express'
import defaultConfDesc from '../config.json'
import type { AuthenticationFunction, TwakeDB } from '../types'
import {
  deleteRecoveryWords,
  getRecoveryWords,
  methodNotAllowed,
  saveRecoveryWords,
  updateRecoveryWords,
  type VaultController
} from './controllers/vault'
import isAuth, { type tokenDetail } from './middlewares/auth'
import parser from './middlewares/parser'
import {
  allowCors,
  errorMiddleware,
  type expressAppHandler,
  type expressAppHandlerError
} from './utils'

declare module 'express-serve-static-core' {
  interface Request {
    token: tokenDetail
  }
}

export const defaultConfig = defaultConfDesc

export default class TwakeVaultAPI {
  endpoints: Router

  constructor(
    public db: TwakeDB,
    public authenticator: AuthenticationFunction
  ) {
    this.endpoints = Router()
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
      /**
       * @openapi
       * '/_twake/recoveryWords':
       *  put:
       *    tags:
       *    - Vault API
       *    description: Update stored connected user recovery words in database
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
       *                description: The new recovery words of the connected user
       *            required:
       *              - words
       *          example:
       *            words: This is the updated recovery sentence of rtyler
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
       *                  description: Message indicating that words have been successfully updated
       *              example:
       *                message: Updated recovery words sucessfully
       *      401:
       *        $ref: '#/components/responses/Unauthorized'
       *      500:
       *        $ref: '#/components/responses/InternalServerError'
       *      400:
       *        description: Bad request
       */
      .put(...this._middlewares(updateRecoveryWords))
      .all(allowCors, methodNotAllowed, errorMiddleware)
  }

  private _middlewares(
    controller: VaultController
  ): Array<expressAppHandler | expressAppHandlerError> {
    return [
      allowCors,
      ...parser,
      isAuth(this.authenticator),
      controller(this.db),
      errorMiddleware
    ]
  }
}
