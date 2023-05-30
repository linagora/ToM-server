import { transaction, query } from '../controllers'
import {
  allowCors,
  errorMiddleware,
  legacyEndpointHandler,
  methodNotAllowed,
  Endpoints,
  type expressAppHandler,
  type expressAppHandlerError
} from '../utils'
import validation from '../middlewares/validation'
import type MatrixApplicationServer from '..'
import { type ValidationChain } from 'express-validator'
import auth from '../middlewares/auth'
import { type IRoute, Router, json, urlencoded } from 'express'

export enum EHttpMethod {
  DELETE = 'DELETE',
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT'
}

export default class MASRouter {
  routes: Router
  constructor(private readonly _appServer: MatrixApplicationServer) {
    this.routes = Router()
    /**
     * @openapi
     * '/_matrix/app/v1/transactions/{txnId}':
     *  put:
     *    parameters:
     *      - in: path
     *        name: txnId
     *        required: true
     *        schema:
     *          type: integer
     *        description: The transaction id
     *    tags:
     *    - Application server
     *    description: Implements https://spec.matrix.org/v1.6/application-service-api/#put_matrixappv1transactionstxnid
     *    responses:
     *      200:
     *        description: Success
     *        content:
     *          application/json:
     *            schema:
     *              type: object
     *      308:
     *        $ref: '#/components/responses/PermanentRedirect'
     *      400:
     *        $ref: '#/components/responses/BadRequest'
     *      401:
     *        $ref: '#/components/responses/MatrixUnauthorized'
     *      403:
     *        $ref: '#/components/responses/Forbidden'
     *      404:
     *        description: Not found
     *        content:
     *          application/json:
     *            schema:
     *              type: object
     *      500:
     *        $ref: '#/components/responses/InternalServerError'
     */
    this.routes
      .route('/_matrix/app/v1/transactions/:txnId')
      .put(
        this._middlewares(
          transaction(this._appServer),
          validation(Endpoints.TRANSACTIONS)
        )
      )
      .all(allowCors, methodNotAllowed, errorMiddleware)

    /**
     * @openapi
     * '/_matrix/app/v1/users/{userId}':
     *  get:
     *    parameters:
     *      - in: path
     *        name: userId
     *        required: true
     *        schema:
     *          type: integer
     *        description: The user id
     *    tags:
     *    - Application server
     *    description: Implements https://spec.matrix.org/v1.6/application-service-api/#get_matrixappv1usersuserid
     *    responses:
     *      200:
     *        description: Success
     *        content:
     *          application/json:
     *            schema:
     *              type: object
     *      400:
     *        $ref: '#/components/responses/BadRequest'
     *      401:
     *        $ref: '#/components/responses/MatrixUnauthorized'
     *      403:
     *        $ref: '#/components/responses/Forbidden'
     *      500:
     *        $ref: '#/components/responses/InternalServerError'
     */
    this.routes
      .route('/_matrix/app/v1/users/:userId')
      .get(this._middlewares(query, validation(Endpoints.USERS)))
      .all(allowCors, methodNotAllowed, errorMiddleware)

    /**
     * @openapi
     * '/_matrix/app/v1/rooms/{roomAlias}':
     *  get:
     *    parameters:
     *      - in: path
     *        name: roomAlias
     *        required: true
     *        schema:
     *          type: integer
     *        description: The room alias
     *    tags:
     *    - Application server
     *    description: Implements https://spec.matrix.org/v1.6/application-service-api/#get_matrixappv1roomsroomalias
     *    responses:
     *      200:
     *        description: Success
     *        content:
     *          application/json:
     *            schema:
     *              type: object
     *      400:
     *        $ref: '#/components/responses/BadRequest'
     *      401:
     *        $ref: '#/components/responses/MatrixUnauthorized'
     *      403:
     *        $ref: '#/components/responses/Forbidden'
     *      500:
     *        $ref: '#/components/responses/InternalServerError'
     */
    this.routes
      .route('/_matrix/app/v1/rooms/:roomAlias')
      .get(this._middlewares(query, validation(Endpoints.ROOMS)))
      .all(allowCors, methodNotAllowed, errorMiddleware)

    this.routes.all(
      /^\/users|rooms|transactions\/:[a-zA-Z0-9]/g,
      legacyEndpointHandler
    )
  }

  /**
   * Get an array of middlewares that the request should go through
   * @param {string} endpoint Request resource endpoint
   * @return {Array<expressAppHandler | expressAppHandlerError | ValidationChain>} Array of middlewares
   */
  protected _middlewares(
    controller: expressAppHandler,
    validators: ValidationChain[],
    authMiddleware = auth(this._appServer.appServiceRegistration.hsToken)
  ): Array<expressAppHandler | expressAppHandlerError | ValidationChain> {
    return [
      allowCors,
      json(),
      urlencoded({ extended: false }),
      authMiddleware,
      ...validators,
      controller,
      errorMiddleware
    ]
  }

  public addRoute(
    path: string,
    method: EHttpMethod,
    controller: expressAppHandler,
    validators: ValidationChain[],
    authMiddleware = auth(this._appServer.appServiceRegistration.hsToken)
  ): void {
    const route: IRoute = this.routes.route(path)
    switch (method) {
      case EHttpMethod.DELETE:
        route.delete(this._middlewares(controller, validators, authMiddleware))
        break
      case EHttpMethod.GET:
        route.get(this._middlewares(controller, validators, authMiddleware))
        break
      case EHttpMethod.POST:
        route.post(this._middlewares(controller, validators, authMiddleware))
        break
      case EHttpMethod.PUT:
        route.put(this._middlewares(controller, validators, authMiddleware))
        break
      default:
        break
    }
    route.all(allowCors, methodNotAllowed, errorMiddleware)
  }
}
