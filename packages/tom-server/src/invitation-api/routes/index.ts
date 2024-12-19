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
import authMiddleware from '../../utils/middlewares/auth.middleware'
import InvitationApiController from '../controllers'

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

  router.post(PATH, authenticate)

  router.post(
    `${PATH}/generate`,
    authenticate,
    controller.generateInvitationLink
  )

  router.get(`${PATH}/list`, authenticate, controller.listInvitations)

  router.get(`${PATH}/:id`, authenticate, controller.acceptInvitation)

  return router
}
