/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake/logger'
import type { AuthenticationFunction, Config, TwakeDB } from '../../types'
import { Router } from 'express'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import ActiveContactsApiController from '../controllers'
import ActiveContactsApiValidationMiddleWare from '../middlewares'

export const PATH = '/_twake/v1/activecontacts'

export default (
  db: TwakeDB,
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

  /**
   * @openapi
   * components:
   *  schemas:
   *    ActiveContacts:
   *      type: object
   *      description: the list of active contacts
   *      properties:
   *        contacts:
   *          type: string
   *          description: active contacts
   *  responses:
   *    NotFound:
   *      description: no active contacts found
   *    Unauthorized:
   *      description: the user is not authorized
   *    Created:
   *      description: active contacts saved
   *    NoContent:
   *      description: operation successful and no content returned
   */

  /**
   * @openapi
   * /_twake/v1/activecontacts:
   *  get:
   *    tags:
   *      - Active contacts
   *    description: Get the list of active contacts
   *    responses:
   *      200:
   *        description: Active contacts found
   *        content:
   *          application/json:
   *            schema:
   *                $ref: '#/components/schemas/ActiveContacts'
   *      404:
   *        description: Active contacts not found
   *      401:
   *        description: user is unauthorized
   *      500:
   *        description: Internal error
   */
  router.get(PATH, authenticate, activeContactsApiController.get)

  /**
   * @openapi
   * /_twake/v1/activecontacts:
   *  post:
   *    tags:
   *      - Active contacts
   *    description: Create or update the list of active contacts
   *    requestBody:
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/ActiveContacts'
   *    responses:
   *      201:
   *        description: Active contacts saved
   *      401:
   *        description: user is unauthorized
   *      400:
   *        description: Bad request
   *      500:
   *        description: Internal error
   */
  router.post(
    PATH,
    authenticate,
    validationMiddleware.checkCreationRequirements,
    activeContactsApiController.save
  )

  /**
   * @openapi
   * /_twake/v1/activecontacts:
   *  delete:
   *    tags:
   *      - Active contacts
   *    description: Delete the list of active contacts
   *    responses:
   *      200:
   *        description: Active contacts deleted
   *      401:
   *        description: user is unauthorized
   *      500:
   *        description: Internal error/
   */
  router.delete(PATH, authenticate, activeContactsApiController.delete)

  return router
}
