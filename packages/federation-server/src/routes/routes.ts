import { type TwakeLogger } from '@twake/logger'
import { type IdServerAPI, type Utils } from '@twake/matrix-identity-server'
import { Router, json, urlencoded } from 'express'
import { hashDetails, lookup, lookups } from '../controllers/controllers'
import { auth } from '../middlewares/auth'
import { errorMiddleware } from '../middlewares/errors'
import {
  allowCors,
  methodNotAllowed,
  methodNotFound
} from '../middlewares/utils'
import {
  commonValidators,
  lookupValidator,
  lookupsValidator
} from '../middlewares/validation'
import {
  type Config,
  type IdentityServerDb,
  type expressAppHandler,
  type middlewaresList
} from '../types'

const errorMiddlewares = (middleware: expressAppHandler): middlewaresList => [
  allowCors,
  middleware,
  errorMiddleware
]

export default (
  api: {
    get: IdServerAPI
    post: IdServerAPI
    put?: IdServerAPI
  },
  db: IdentityServerDb,
  authenticate: Utils.AuthenticationFunction,
  conf: Config,
  logger: TwakeLogger
): Router => {
  const routes = Router()
  /**
   * @openapi
   * '/_matrix/identity/v2/lookup':
   *  post:
   *    tags:
   *    - Federation server
   *    description: Extends https://spec.matrix.org/v1.6/identity-service-api/#post_matrixidentityv2lookup to display inactive users and 3PID users
   *    requestBody:
   *      description: Object containing hashes of mails/phones to search
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *            properties:
   *              addresses:
   *                type: array
   *                items:
   *                  type: string
   *                  description: List of (hashed) addresses to lookup
   *              algorithm:
   *                type: string
   *                description: Algorithm the client is using to encode the addresses
   *              pepper:
   *                type: string
   *                description: Pepper from '/hash_details'
   *            required:
   *              - addresses
   *              - algorithm
   *              - pepper
   *          example:
   *            addresses: ["4kenr7N9drpCJ4AfalmlGQVsOn3o2RHjkADUpXJWZUc", "nlo35_T5fzSGZzJApqu8lgIudJvmOQtDaHtr-I4rU7I"]
   *            algorithm: "sha256"
   *            pepper: "matrixrocks"
   *    responses:
   *      200:
   *        description: Success
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                mappings:
   *                  type: object
   *                  additionalProperties:
   *                    type: string
   *                  description: List of active accounts
   *                inactive_mappings:
   *                  type: object
   *                  additionalProperties:
   *                    type: string
   *                  description: List of inactive accounts
   *                third_party_mappings:
   *                  type: object
   *                  description: List of hashed addresses by identity server hostname
   *                  properties:
   *                    hostname:
   *                      type: object
   *                      properties:
   *                        actives:
   *                          type: array
   *                          items:
   *                            type: string
   *                            description: List of (hashed) active accounts addresses matching request body addresses
   *                        inactives:
   *                          type: array
   *                          items:
   *                            type: string
   *                            description: List of (hashed) inactive accounts addresses matching request body addresses
   *            example:
   *              mappings:
   *                "4kenr7N9drpCJ4AfalmlGQVsOn3o2RHjkADUpXJWZUc": "@dwho:company.com"
   *              inactive_mappings:
   *                "nlo35_T5fzSGZzJApqu8lgIudJvmOQtDaHtr-I4rU7I": "@rtyler:company.com"
   *              third_party_mappings:
   *                "identity1.example.com": {"actives": ["78jnr7N9drpCJ4AfalmlGQVsOn3o2RHjkADUpXJWZUc","gtr42_T5fzSGZzJAmlp5lgIudJvmOQtDaHtr-I4rU7I"],"inactives": ["qfgt57N9drpCJ4AfalmlGQVsOn3o2RHjkADUpXJWZUc","lnbc8_T5fzSGZzJAmlp5lgIudJvmOQtDaHtr-I4rU7I"]}
   *      401:
   *        $ref: '#/components/responses/Unauthorized'
   *      400:
   *        $ref: '#/components/responses/BadRequest'
   *      404:
   *        $ref: '#/components/responses/NotFound'
   *      405:
   *        $ref: '#/components/responses/Unrecognized'
   *      500:
   *        $ref: '#/components/responses/InternalServerError'
   */
  routes
    .route('/_matrix/identity/v2/lookup')
    .post(
      allowCors,
      json(),
      urlencoded({ extended: false }),
      auth(authenticate, conf.trusted_servers_addresses, logger),
      ...commonValidators,
      lookupValidator,
      lookup(conf, db),
      errorMiddleware
    )
    .all(...errorMiddlewares(methodNotAllowed))

  /**
   * @openapi
   * '/_matrix/identity/v2/hash_details':
   *  get:
   *    tags:
   *    - Federation server
   *    description: Implements https://spec.matrix.org/v1.6/identity-service-api/#get_matrixidentityv2hash_details
   */
  routes
    .route('/_matrix/identity/v2/hash_details')
    .get(
      allowCors,
      json(),
      urlencoded({ extended: false }),
      auth(authenticate, conf.trusted_servers_addresses, logger),
      hashDetails(db),
      errorMiddleware
    )
    .all(...errorMiddlewares(methodNotAllowed))

  const defaultGetEndpoints = Object.keys(api.get)
  const defaultPostEndpoints = Object.keys(api.post)

  defaultGetEndpoints.forEach((k) => {
    routes.route(k).get(api.get[k])
  })
  defaultPostEndpoints.forEach((k) => {
    routes.route(k).post(api.post[k])
  })

  const allDefaultEndpoints = [
    ...new Set([...defaultGetEndpoints, ...defaultPostEndpoints])
  ]

  allDefaultEndpoints.forEach((k) => {
    routes.route(k).all(...errorMiddlewares(methodNotAllowed))
  })

  /**
   * @openapi
   * '/_matrix/identity/v2/lookups':
   *  post:
   *    tags:
   *    - Federation server
   *    description: Implements https://github.com/guimard/matrix-spec-proposals/blob/unified-identity-service/proposals/4004-unified-identity-service-view.md
   *    requestBody:
   *      description: Object containing hashes to store in federation server database
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *            properties:
   *              mappings:
   *                type: object
   *                description: List of hashed addresses by identity server hostname
   *                properties:
   *                  hostname:
   *                    type: array
   *                    items:
   *                      type: object
   *                      properties:
   *                        hash:
   *                          type: string
   *                        active:
   *                          type: number
   *              algorithm:
   *                type: string
   *                description: Algorithm the client is using to encode the addresses
   *              pepper:
   *                type: string
   *                description: Pepper from '/hash_details'
   *            required:
   *              - addresses
   *              - algorithm
   *              - pepper
   *          example:
   *            mappings:
   *              "identity1.example.com": [{"hash": "4kenr7N9drpCJ4AfalmlGQVsOn3o2RHjkADUpXJWZUc","active": 1},{"hash": "nlo35_T5fzSGZzJApqu8lgIudJvmOQtDaHtr-I4rU7I","active": 0}]
   *            algorithm: "sha256"
   *            pepper: "matrixrocks"
   *    responses:
   *      201:
   *        description: Success
   *      401:
   *        $ref: '#/components/responses/Unauthorized'
   *      400:
   *        $ref: '#/components/responses/BadRequest'
   *      404:
   *        $ref: '#/components/responses/NotFound'
   *      405:
   *        $ref: '#/components/responses/Unrecognized'
   *      500:
   *        $ref: '#/components/responses/InternalServerError'
   */
  routes
    .route('/_matrix/identity/v2/lookups')
    .post(
      allowCors,
      json(),
      urlencoded({ extended: false }),
      auth(authenticate, conf.trusted_servers_addresses, logger),
      ...commonValidators,
      lookupsValidator,
      lookups(db),
      errorMiddleware
    )
    .all(...errorMiddlewares(methodNotAllowed))

  routes.use(...errorMiddlewares(methodNotFound))

  return routes
}
