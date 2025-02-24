import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import type { AuthenticationFunction, Config, TwakeDB } from '../../types'
import { Router } from 'express'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import { AddressbookApiController } from '../controllers'
import { AddressBookApiMiddleware } from '../middlewares'

export const PATH = '/_twake/addressbook'

export default (
  config: Config,
  db: TwakeDB,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticate = authMiddleware(authenticator, logger)
  const controller = new AddressbookApiController(db, logger)
  const middleware = new AddressBookApiMiddleware(db, logger)

  router.get(PATH, authenticate, controller.listAddressbook)

  router.delete(PATH, authenticate, controller.deleteAddressbook)

  router.post(
    PATH,
    authenticate,
    middleware.validateContactsCreation,
    controller.addContacts
  )

  router.get(
    `${PATH}/:id`,
    authenticate,
    middleware.checkContactOwnership,
    controller.fetchContact
  )

  router.put(
    `${PATH}/:id`,
    authenticate,
    middleware.checkContactOwnership,
    middleware.validateContactUpdate,
    controller.updateContact
  )

  router.delete(
    `${PATH}/:id`,
    authenticate,
    middleware.checkContactOwnership,
    controller.deleteContact
  )

  return router
}
