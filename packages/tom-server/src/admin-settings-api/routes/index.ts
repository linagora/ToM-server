import { Router } from 'express'
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake-chat/logger'
import type { Config, ITokenService } from '../../types.ts'
import AdminSettingsrController from '../controllers/index.ts'
import AdminSettingsMiddleware from '../middlewares/index.ts'

export const PATH = '/_twake/v1/admin'

export default (
  config: Config,
  defaultLogger?: TwakeLogger,
  tokenService?: ITokenService
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const controller = new AdminSettingsrController(config, logger, tokenService)
  // TODO: investigate unused logger
  // const middleware = new AdminSettingsMiddleware(config, logger)
  const middleware = new AdminSettingsMiddleware(config)
  /**
   * Set display name
   * @see https://matrix-org.github.io/synapse/latest/admin_api/user_admin_api.html#create-or-modify-account
   * @authentication required
   * @body { userId: string, displayname: string }
   * @returns { 200, 400, 401, 403, 500 }
   */
  router.post(
    `${PATH}/settings/information/:id`,
    middleware.checkAdminSettingsToken,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    controller.handle
  )

  return router
}
