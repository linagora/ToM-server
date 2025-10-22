import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake/logger'
import type { AuthenticationFunction, Config, TwakeDB } from '../../../../types'
import { Router } from 'express'
import DisplayNameController from '../controllers'
import authMiddleware from '../../../../utils/middlewares/auth.middleware'

/**
 * User profile route
 *
 * @param {Config} config
 * @param {TwakeLogger} defaultLogger
 * @returns {Router}
 */
export default (
  config: Config,
  authenticator: AuthenticationFunction,
  db: TwakeDB,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router({ mergeParams: true }) // merge params with parent router to get userId
  const controller = new DisplayNameController(config, logger, db)
  const authenticate = authMiddleware(authenticator, logger)

  // get the profile
  router.get('/', authenticate, controller.get)

  // update the user profile display name
  router.get('/displayname', authenticate, controller.getDisplayName)
  router.put('/displayname', authenticate, controller.updateDisplayName)

  return router
}
