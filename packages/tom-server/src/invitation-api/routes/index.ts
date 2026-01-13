import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake-chat/logger'
import type {
  AuthenticationFunction,
  Config,
  TwakeDB,
  ITokenService
} from '../../types'
import { Router } from 'express'
import bodyParser from 'body-parser'
import InvitationApiController from '../controllers'
import invitationApiMiddleware from '../middlewares'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import CookieAuthenticator from '../../utils/middlewares/cookie-auth.middleware'
import errorMiddleware from '../../utils/middlewares/error.middleware'
import { MatrixDB, UserDB } from '@twake-chat/matrix-identity-server'
import UserInfoService from '../../user-info-api/services'

export const PATH = '/_twake/v1/invite'

export default (
  config: Config,
  db: TwakeDB,
  userdb: UserDB,
  matrixdb: MatrixDB,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger,
  userInfoService?: UserInfoService,
  tokenService?: ITokenService
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticate = authMiddleware(authenticator, logger)
  const controller = new InvitationApiController(
    db,
    userdb,
    matrixdb,
    logger,
    config,
    userInfoService
  )
  const middleware = new invitationApiMiddleware(db, logger, config)
  const cookieAuthMiddleware = new CookieAuthenticator(
    config,
    logger,
    tokenService
  )

  router.use(bodyParser.json())
  router.use(PATH, middleware.checkFeatureEnabled)

  /**
   * @openapi
   * components:
   *  schemas:
   *   Invitation:
   *    type: object
   *    properties:
   *      contact:
   *        type: string
   *        description: The contact to send the invitation to
   *      medium:
   *        type: string
   *        description: The medium to send the invitation through
   *    required:
   *      - contact
   *      - medium
   *  securitySchemes:
   *    cookieAuth:
   *      type: apiKey
   *      in: cookie
   *      name: lemonldap
   */

  /**
   * @openapi
   * /_twake/v1/invite:
   *  post:
   *   tags:
   *   - Invitation
   *   description: Sends an invitation to a user
   *   requestBody:
   *    content:
   *      application/json:
   *       schema:
   *        $ref: '#/components/schemas/Invitation'
   *   responses:
   *    200:
   *      description: Invitation sent
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *            properties:
   *             message:
   *              type: string
   *             id:
   *              type: string
   *    400:
   *      description: Bad request
   *    401:
   *      description: Unauthorized
   *    429:
   *      description: Too many requests
   *    500:
   *      description: Internal Server Error
   */
  router.post(
    PATH,
    authenticate,
    middleware.checkInvitationPayload,
    middleware.rateLimitInvitations,
    controller.sendInvitation
  )

  /**
   * @openapi
   * /_twake/v1/invite/generate:
   *  post:
   *   tags:
   *   - Invitation
   *   description: generates an invitation link
   *   requestBody:
   *    required: false
   *    content:
   *      application/json:
   *       schema:
   *        $ref: '#/components/schemas/Invitation'
   *   responses:
   *    200:
   *      description: Invitation sent
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *            properties:
   *             link:
   *              type: string
   *             id:
   *              type: string
   *    400:
   *      description: Bad request
   *    401:
   *      description: Unauthorized
   *    500:
   *      description: Internal Server Error
   */
  router.post(
    `${PATH}/generate`,
    authenticate,
    middleware.checkGenerateInvitationLinkPayload,
    controller.generateInvitationLink
  )

  /**
   * @openapi
   * /_twake/v1/invite/list:
   *  get:
   *   tags:
   *   - Invitation
   *   description: List all invitations sent by the user
   *   responses:
   *    200:
   *      description: List of invitations
   *      content:
   *        application/json:
   *          schema:
   *            type: array
   *            items:
   *              type: object
   *              properties:
   *                id:
   *                  type: string
   *                sender:
   *                  type: string
   *                recipient:
   *                  oneOf:
   *                    - type: string
   *                    - type: null
   *                medium:
   *                  oneOf:
   *                    - type: string
   *                    - type: null
   *                expiration:
   *                  type: number
   *                accessed:
   *                  type: boolean
   *                matrix_id:
   *                  oneOf:
   *                    - type: string
   *                    - type: null
   *    400:
   *      description: Bad request
   *    401:
   *      description: Unauthorized
   */
  router.get(`${PATH}/list`, authenticate, controller.listInvitations)

  /**
   * @openapi
   * /_twake/v1/invite/{id}:
   *  delete:
   *    tags:
   *     - Invitation
   *    parameters:
   *      - in: path
   *        name: id
   *        required: true
   *        schema:
   *          type: string
   *        description: The invitation ID
   *    description: Remove an invitation
   *    responses:
   *      200:
   *        description: Invitation removed
   *      400:
   *        description: Invalid invitation
   *      401:
   *        description: Unauthorized
   *      403:
   *        description: Forbidden
   *      404:
   *        description: Invitation not found
   *      500:
   *        description: Internal error
   */
  router.delete(
    `${PATH}/:id`,
    authenticate,
    middleware.checkInvitationOwnership,
    controller.removeInvitation
  )

  /**
   * @openapi
   * /_twake/v1/invite/{id}:
   *  get:
   *    tags:
   *     - Invitation
   *    security:
   *      - cookieAuth: []
   *    parameters:
   *      - in: path
   *        name: id
   *        required: true
   *        schema:
   *          type: string
   *        description: The invitation ID
   *    description: Accepts an invitation
   *    responses:
   *      301:
   *        description: Redirect to the invitation redirect url
   *      400:
   *        description: Invalid invitation
   *      404:
   *        description: Invitation not found
   */
  router.get(
    `${PATH}/:id`,
    cookieAuthMiddleware.authenticateWithCookie,
    authenticate,
    middleware.checkInvitation,
    controller.acceptInvitation
  )

  /**
   * @openapi
   * /_twake/v1/invite/{id}/status:
   *  get:
   *    tags:
   *     - Invitation
   *    parameters:
   *      - in: path
   *        name: id
   *        required: true
   *        schema:
   *          type: string
   *        description: The invitation ID
   *    description: Get the status of an invitation
   *    responses:
   *      200:
   *        description: Invitation status
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                id:
   *                  type: string
   *                sender:
   *                  type: string
   *                recipient:
   *                  oneOf:
   *                    - type: string
   *                    - type: null
   *                medium:
   *                  oneOf:
   *                    - type: string
   *                    - type: null
   *                expiration:
   *                  type: number
   *                accessed:
   *                  type: boolean
   *                matrix_id:
   *                  oneOf:
   *                    - type: string
   *                    - type: null
   *      400:
   *        description: Invalid invitation
   *      401:
   *        description: Unauthorized
   *      404:
   *        description: Invitation not found
   *      403:
   *        description: You are not the owner of this invitation
   *      500:
   *        description: Internal error
   */
  router.get(
    `${PATH}/:id/status`,
    authenticate,
    middleware.checkInvitationOwnership,
    controller.getInvitationStatus
  )

  router.use(errorMiddleware(logger))

  return router
}
