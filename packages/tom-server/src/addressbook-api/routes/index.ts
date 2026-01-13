import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake-chat/logger'
import type { AuthenticationFunction, Config, TwakeDB } from '../../types.ts'
import { Router } from 'express'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import AddressbookApiController from '../controllers/index.ts'
import AddressBookApiMiddleware from '../middlewares/index.ts'
import type { IAddressbookService } from '../types'
import type { IUserInfoService } from '../../user-info-api/types'

export const PATH = '/_twake/addressbook'

export default (
  config: Config,
  db: TwakeDB,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger,
  addressbookService?: IAddressbookService,
  userInfoService?: IUserInfoService
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticate = authMiddleware(authenticator, logger)
  const controller = new AddressbookApiController(
    db,
    logger,
    addressbookService,
    userInfoService
  )
  const middleware = new AddressBookApiMiddleware(db, logger)

  /**
   * @openapi
   * components:
   *  schemas:
   *    Addressbook:
   *      type: object
   *      properties:
   *        id:
   *          type: string
   *        owner:
   *          type: string
   *        contacts:
   *          type: array
   *          items:
   *            $ref: '#/components/schemas/Contact'
   *    Contact:
   *      type: object
   *      properties:
   *        id:
   *          type: string
   *        mxid:
   *          type: string
   *        display_name:
   *          type: string
   *        active:
   *          type: boolean
   *        addressbook_id:
   *          type: string
   *    ContactCreationPayload:
   *      type: object
   *      properties:
   *        mxid:
   *          type: string
   *        display_name:
   *          type: string
   *    ContactUpdatePayload:
   *      type: object
   *      properties:
   *        display_name:
   *          type: string
   *        active:
   *          type: boolean
   *          required: false
   */

  /**
   * @openapi
   * /_twake/addressbook:
   *  get:
   *   tags:
   *   - Addressbook
   *   description: List all contacts in the addressbook
   *   responses:
   *    200:
   *      description: List of contacts
   *      content:
   *        application/json:
   *          schema:
   *            type: array
   *            items:
   *              $ref: '#/components/schemas/Addressbook'
   *    401:
   *      description: Unauthorized
   *    429:
   *      description: Too many requests
   *    500:
   *      description: Internal server error
   */
  router.get(PATH, authenticate, controller.listAddressbook)

  /**
   * @openapi
   * /_twake/addressbook:
   *  delete:
   *   tags:
   *   - Addressbook
   *   description: Delete the addressbook
   *   responses:
   *    200:
   *      description: Addressbook deleted
   *    401:
   *      description: Unauthorized
   *    429:
   *      description: Too many requests
   *    500:
   *      description: Internal server error
   */
  router.delete(PATH, authenticate, controller.deleteAddressbook)

  /**
   * @openapi
   * /_twake/addressbook:
   *  post:
   *   tags:
   *   - Addressbook
   *   description: Add contacts to the addressbook
   *   requestBody:
   *    description: The contacts to add
   *    required: true
   *    content:
   *      application/json:
   *        schema:
   *          type: object
   *          properties:
   *            contacts:
   *              type: array
   *              items:
   *                $ref: '#/components/schemas/ContactCreationPayload'
   *   responses:
   *    200:
   *      description: List of contacts
   *      content:
   *        application/json:
   *          schema:
   *            type: array
   *            items:
   *              $ref: '#/components/schemas/Addressbook'
   *    400:
   *      description: Bad request
   *    401:
   *      description: Unauthorized
   *    429:
   *      description: Too many requests
   *    500:
   *      description: Internal server error
   */
  router.post(
    PATH,
    authenticate,
    middleware.validateContactsCreation,
    controller.addContacts
  )

  /**
   * @openapi
   * /_twake/addressbook/{id}:
   *  get:
   *   tags:
   *   - Addressbook
   *   description: Get a contact
   *   responses:
   *    200:
   *      description: Contact
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/Contact'
   *    401:
   *      description: Unauthorized
   *    404:
   *      description: Contact not found
   *    429:
   *      description: Too many requests
   *    500:
   *      description: Internal server error
   */
  router.get(
    `${PATH}/:id`,
    authenticate,
    middleware.checkContactOwnership,
    controller.fetchContact
  )

  /**
   * @openapi
   * /_twake/addressbook/{id}:
   *  put:
   *   tags:
   *   - Addressbook
   *   description: Update a contact
   *   requestBody:
   *    description: The contact to update
   *    required: true
   *    content:
   *      application/json:
   *        schema:
   *          $ref: '#/components/schemas/ContactUpdatePayload'
   *   responses:
   *    200:
   *      description: Contact
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/Contact'
   *    400:
   *      description: Bad request
   *    401:
   *      description: Unauthorized
   *    404:
   *      description: Contact not found
   *    429:
   *      description: Too many requests
   *    500:
   *      description: Internal server error
   */
  router.put(
    `${PATH}/:id`,
    authenticate,
    middleware.checkContactOwnership,
    middleware.validateContactUpdate,
    controller.updateContact
  )

  /**
   * @openapi
   * /_twake/addressbook/{id}:
   *  delete:
   *   tags:
   *   - Addressbook
   *   description: Delete a contact
   *   responses:
   *    200:
   *      description: Contact deleted
   *    401:
   *      description: Unauthorized
   *    404:
   *      description: Contact not found
   *    429:
   *      description: Too many requests
   *    500:
   *      description: Internal server error
   */
  router.delete(
    `${PATH}/:id`,
    authenticate,
    middleware.checkContactOwnership,
    controller.deleteContact
  )

  return router
}
