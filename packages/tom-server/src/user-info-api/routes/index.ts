/* eslint-disable @typescript-eslint/no-misused-promises */
import type { Config } from '../../types'
import { Router } from 'express'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import UserInfoController from '../controllers'
import type TwakeIdentityServer from '../../identity-server'
import checkLdapMiddleware from '../middlewares/require-ldap'
import {
  type TwakeLogger,
  getLogger,
  type Config as LoggerConfig
} from '@twake/logger'
export const PATH = '/_twake/v1/user_info'

export default (
  idServer: TwakeIdentityServer,
  config: Config,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticator = authMiddleware(idServer.db, config, logger)
  const userInfoController = new UserInfoController(idServer.userDB)
  const requireLdap = checkLdapMiddleware(config, logger)

  /**
   * @openapi
   * components:
   *  parameters:
   *    userId:
   *      in: path
   *      name: userId
   *      description: the user id
   *      required: true
   *      schema:
   *        type: string
   *  schemas:
   *    UserInfo:
   *      type: object
   *      properties:
   *        uid:
   *          type: string
   *          description: the user id
   *        givenName:
   *          type: string
   *          description: the user given name
   *        sn:
   *          type: string
   *          description: the user surname
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

  return router
}
