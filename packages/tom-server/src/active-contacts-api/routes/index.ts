/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake/logger'
import type {
  AuthenticationFunction,
  Config,
  IdentityServerDb
} from '../../types'
import { Router } from 'express'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import ActiveContactsApiController from '../controllers'
import ActiveContactsApiValidationMiddleWare from '../middlewares'

export const PATH = '/_twake/v1/activecontacts'

export default (
  db: IdentityServerDb,
  config: Config,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const activeContactsApiController = new ActiveContactsApiController(
    db,
    logger
  )
  const authenticate = authMiddleware(authenticator, logger)
  const validationMiddleware = new ActiveContactsApiValidationMiddleWare()
  const router = Router()

  router.get(PATH, authenticate, activeContactsApiController.get)

  router.post(
    PATH,
    authenticate,
    validationMiddleware.checkCreationRequirements,
    activeContactsApiController.save
  )

  router.delete(PATH, authenticate, activeContactsApiController.delete)

  return router
}
