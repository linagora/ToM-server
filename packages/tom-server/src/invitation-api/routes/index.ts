import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake/logger'
import {
  type AuthenticationFunction,
  type Config,
  type TwakeDB
} from '../../types'
import { Router } from 'express'
import bodyParser from 'body-parser'
import InvitationApiController from '../controllers'
import invitationApiMiddleware from '../middlewares'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import CookieAuthenticator from '../../utils/middlewares/cookie-auth.middleware'

export const PATH = '/_twake/v1/invite'

export default (
  config: Config,
  db: TwakeDB,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticate = authMiddleware(authenticator, logger)
  const controller = new InvitationApiController(db, logger, config)
  const middleware = new invitationApiMiddleware(db, logger)
  const cookieAuthMiddleware = new CookieAuthenticator(config, logger)

  router.use(bodyParser.json())

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
   *    400:
   *      description: Bad request
   *    401:
   *      description: Unauthorized
   *    429:
   *      description: Too many requests
   */
  router.post(
    `${PATH}/generate`,
    authenticate,
    middleware.checkInvitationPayload,
    middleware.rateLimitInvitations,
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
   *                recepient:
   *                  type: string
   *                medium:
   *                  type: string
   *                expiration:
   *                  type: number
   *                accessed:
   *                  type: boolean
   *    400:
   *      description: Bad request
   *    401:
   *      description: Unauthorized
   */
  router.get(`${PATH}/list`, authenticate, controller.listInvitations)

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

  return router
}
