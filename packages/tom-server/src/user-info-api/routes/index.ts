/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import { Router } from 'express'
import type IdServer from '../../identity-server'
import type { Config } from '../../types'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import UserInfoController from '../controllers'
import checkLdapMiddleware from '../middlewares/require-ldap'
import { type MatrixDB } from '@twake/matrix-identity-server'
import type { IUserInfoService } from '../types'
export const PATH = '/_twake/v1/user_info'

export default (
  idServer: IdServer,
  config: Config,
  matrixDB: MatrixDB,
  defaultLogger?: TwakeLogger,
  userInfoService?: IUserInfoService
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticator = authMiddleware(idServer.authenticate, logger)
  const userInfoController = new UserInfoController(
    idServer.userDB,
    idServer.db,
    matrixDB,
    config,
    logger,
    userInfoService
  )
  const requireLdap = checkLdapMiddleware(config, logger)

  /**
   * @openapi
   * components:
   *  parameters:
   *    userId:
   *      in: path
   *      name: userId
   *      description: The user‑id used in the request path.
   *      required: true
   *      schema:
   *        type: string
   *  schemas:
   *    UserInfo:
   *      type: object
   *      description: |
   *        Representation of a Matrix user enriched with optional data from
   *        the local user database and common settings.
   *      required:
   *        - uid
   *        - display_name
   *      properties:
   *        uid:
   *          type: string
   *          description: |
   *            The fully‑qualified Matrix user identifier (e.g.
   *            `@johndoe:matrix.org`). **Always present**.
   *          example: "@johndoe:matrix.org"
   *        display_name:
   *          type: string
   *          description: |
   *            Human‑readable name for the user. **Always present**.
   *          example: "John Doe"
   *        avatar_url:
   *          type: string
   *          format: uri
   *          description: |
   *            URL of the user’s avatar (`mxc://` URI). Present only if the
   *            Matrix server stores an avatar for the user.
   *          example: "mxc://synapse/mediaid"
   *        phones:
   *          type: array
   *          description: |
   *            List of phone numbers associated with the user in the local
   *            UserDB. Present only when such associations exist.
   *          items:
   *            type: string
   *            example: "+1 234 567 8910"
   *        emails:
   *          type: array
   *          description: |
   *            List of e‑mail addresses associated with the user in the local
   *            UserDB. Present only when such associations exist.
   *          items:
   *            type: string
   *            format: email
   *            example: "j.doe@email.com"
   *        sn:
   *          type: string
   *          description: |
   *            *DEPRECATED* Surname (family name) from the UserDB. Present only when the
   *            UserDB contains this attribute.
   *          example: "Doe"
   *        last_name:
   *          type: string
   *          description: |
   *            Given name (first name) from the UserDB. Present only when the
   *            UserDB contains this attribute.
   *          example: "John"
   *        givenName:
   *          type: string
   *          description: |
   *            *DEPRECATED* Surname (family name) from the UserDB. Present only when the
   *            UserDB contains this attribute.
   *          example: "Doe"
   *        first_name:
   *          type: string
   *          description: |
   *            Given name (first name) from the UserDB. Present only when the
   *            UserDB contains this attribute.
   *          example: "John"
   *        language:
   *          type: string
   *          description: |
   *            Preferred language code (e.g. `en`, `fr`). Present only when
   *            common settings are enabled and a value is stored.
   *          example: "en"
   *        timezone:
   *          type: string
   *          description: |
   *            IANA time‑zone identifier (e.g. `Europe/Paris`). Present only
   *            when common settings are enabled and a value is stored.
   *          example: "Europe/Paris"
   */

  /**
   * @openapi
   * /_twake/v1/user_info/{userId}:
   *  get:
   *    tags:
   *      - User Info
   *    description: Get user info
   *    parameters:
   *      - $ref: '#/components/parameters/userId'
   *    responses:
   *      200:
   *        description: User info found
   *        content:
   *          application/json:
   *            schema:
   *              $ref: '#/components/schemas/UserInfo'
   *      404:
   *        description: User info not found
   *      500:
   *        description: Internal server error
   *      401:
   *        description: Unauthorized
   *      400:
   *        description: Bad request
   */
  router.get(
    `${PATH}/:userId`,
    requireLdap,
    authenticator,
    userInfoController.get
  )

  /**
   * @openapi
   * /_twake/v1/user_info/{userId}/visibility:
   *  get:
   *    tags:
   *      - User Info
   *    description: Get user info visibility
   *    parameters:
   *      - $ref: '#/components/parameters/userId'
   *    responses:
   *      200:
   *        description: User info visibility settings found
   *        content:
   *          application/json:
   *            schema:
   *              UserInfoVisibilitySettings:
   *                type: object
   *                description: Representation of the User Information Visibility Settings
   *                required:
   *                  - visibility
   *                  - visible_fields
   *                properties:
   *                  visibility:
   *                    type: string
   *                    description: Defines who can access the selected fields
   *                    enum:
   *                      - public
   *                      - private
   *                      - contacts
   *                    example: contacts
   *                  visible_fields:
   *                    type: array
   *                    description: Name of the fields visible according to visibility
   *                    uniqueItems: true
   *                    maxItems: 2
   *                    items:
   *                      type: string
   *                      enum:
   *                        - email
   *                        - phone
   *      404:
   *        description: User info not found
   *      500:
   *        description: Internal server error
   */
  router.get(
    `${PATH}/:userId/visibility`,
    requireLdap,
    userInfoController.getVisibility
  )

  router.post(
    `${PATH}/:userId/visibility`,
    requireLdap,
    authenticator,
    userInfoController.updateVisibility
  )

  return router
}
