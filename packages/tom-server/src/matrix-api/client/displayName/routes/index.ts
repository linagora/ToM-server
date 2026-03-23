import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake/logger'
import type { AuthenticationFunction, Config } from '../../../../types'
import { Router } from 'express'
import DisplayNameController from '../controllers'
import authMiddleware from '../../../../utils/middlewares/auth.middleware'

/**
 * Update display name route
 *
 * @param {Config} config
 * @param {TwakeLogger} defaultLogger
 * @returns {Router}
 */
export default (
  config: Config,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router({ mergeParams: true }) // merge params with parent router to get userId
  const controller = new DisplayNameController(config, logger)
  const authenticate = authMiddleware(authenticator, logger)

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/', authenticate, controller.updateDisplayName)

  return router
}
