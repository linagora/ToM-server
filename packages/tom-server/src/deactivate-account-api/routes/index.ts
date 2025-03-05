import { Router } from 'express'
import type { MatrixDB } from '@twake/matrix-identity-server'
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import type { Config } from '../../types'
import DeactivateUserController from '../controllers'
import DeactivateUserMiddleware from '../middlewares'

export const PATH = '/_twake/admin/deactivate-user'

export default (
  config: Config,
  db: MatrixDB,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const controller = new DeactivateUserController(config, logger)
  const middleware = new DeactivateUserMiddleware(config, db, logger)

  // TODO: add swagger docs

  router.post(
    `${PATH}/:id`,
    middleware.checkAccessToken,
    middleware.checkUserExists,
    controller.handle
  )

  return router
}
