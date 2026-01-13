import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake-chat/logger'
import type { AuthenticationFunction, Config } from '../../../../types'
import { Router } from 'express'
import CreateRoomController from '../controllers'
import authMiddleware from '../../../../utils/middlewares/auth.middleware'

/**
 * Create room route
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
  const router = Router()
  const controller = new CreateRoomController(config, logger)
  const authenticate = authMiddleware(authenticator, logger)

  router.post('/', authenticate, controller.createRoom)

  return router
}
