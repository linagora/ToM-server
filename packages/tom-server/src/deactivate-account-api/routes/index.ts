import { Router } from 'express'
import type { MatrixDBBackend } from '@twake-chat/matrix-identity-server'
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake-chat/logger'
import type { Config, ITokenService } from '../../types'
import DeactivateUserController from '../controllers'
import DeactivateUserMiddleware from '../middlewares'

export const PATH = '/_twake/admin/deactivate-user'

export default (
  config: Config,
  db: MatrixDBBackend,
  defaultLogger?: TwakeLogger,
  tokenService?: ITokenService
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const controller = new DeactivateUserController(config, logger, tokenService)
  const middleware = new DeactivateUserMiddleware(config, db, logger)

  /**
   * @openapi
   * components:
   *   securitySchemes:
   *     AccessToken:
   *       type: apiKey
   *       in: header
   *       name: x-access-token
   */

  /**
   * @openapi
   * /_twake/admin/deactivate-user/{id}:
   *   post:
   *     summary: Deactivate a user
   *     tags:
   *       - Admin
   *     security:
   *       - AccessToken: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: The user ID to deactivate
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: User deactivated
   *       400:
   *         description: Missing user ID or user is already deactivated
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  router.post(
    `${PATH}/:id`,
    middleware.checkAccessToken,
    middleware.checkUserExists,
    controller.handle
  )

  return router
}
