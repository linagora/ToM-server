import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake/logger'
import type { Config } from '../../../../types'
import { Router } from 'express'
import CreateRoomController from '../controllers'
import CreateRoomMiddleware from '../middlewares'

/**
 * Create room route
 *
 * @param {Config} config
 * @param {TwakeLogger} defaultLogger
 * @returns {Router}
 */
export default (config: Config, defaultLogger?: TwakeLogger): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const controller = new CreateRoomController(config, logger)
  const middleware = new CreateRoomMiddleware(logger)

  router.post('/', middleware.checkPayload, controller.createRoom)

  return router
}
