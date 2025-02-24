import type { TwakeLogger } from '@twake/logger'
import type { AuthRequest, TwakeDB } from '../../types'
import type {
  AddressBook,
  Contact,
  ContactCreationRequest,
  ContactUpdatePayload,
  IAddressbookApiMiddleware
} from '../types'
import type { NextFunction, Response } from 'express'

export class AddressBookApiMiddleware implements IAddressbookApiMiddleware {
  constructor(
    private readonly db: TwakeDB,
    private readonly logger: TwakeLogger
  ) {}

  /**
   * Checks if the user is allowed to access a contact
   *
   * @param {Request} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public checkContactOwnership = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this._checkUserExists(req)) {
        res.status(401).json({ message: 'Unauthorized' })
        return
      }

      const owner = req.userId as string
      const { id } = req.params

      const contact = await this._getContact(id)

      if (!contact) {
        res.status(404).json({ message: 'Contact not found' })
        return
      }

      const addressbook = await this._getAddressbook(contact.addressbook_id)

      if (!addressbook) {
        res.status(404).json({ message: 'Addressbook not found' })
        return
      }

      if (addressbook.owner !== owner) {
        res.status(403).json({ message: 'Forbidden' })
        return
      }

      next()
    } catch (error) {
      next(error)
    }
  }

  /**
   * Checks contact update payload
   *
   * @param {AuthRequest} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next function
   * @returns {Promise<void>}
   */
  validateContactUpdate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payload = req.body as ContactUpdatePayload

      if (!payload.display_name) {
        res.status(400).json({ message: 'Missing display_name' })
        return
      }

      next()
    } catch (error) {
      this.logger.error('Failed to validate contact update payload')
      next(error)
    }
  }

  /**
   * validates contacts creation payload
   *
   * @param {AuthRequest} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next function
   * @returns {Promise<void>}
   */
  validateContactsCreation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payload = req.body as ContactCreationRequest

      if (!payload || !payload.contacts || !Array.isArray(payload.contacts)) {
        res.status(400).json({ message: 'Missing contacts' })
        return
      }

      for (const contact of payload.contacts) {
        if (!contact.mxid) {
          res.status(400).json({ message: 'Missing mxid' })
          return
        }

        if (!contact.display_name) {
          res.status(400).json({ message: 'Missing display_name' })
          return
        }

        if (contact.active === undefined || isNaN(contact.active)) {
          res.status(400).json({ message: 'Missing active' })
          return
        }
      }

      next()
    } catch (error) {
      this.logger.error('Failed to validate contact creation payload')
      next(error)
    }
  }

  /**
   * Checks if the user is defined in the request
   *
   * @param {AuthRequest} req - the request
   * @returns {boolean} - whether the user is defined or not
   */
  private _checkUserExists = (req: AuthRequest): boolean => {
    if (!req.userId) {
      this.logger.error('Request is missing the currently connected user')
      return false
    }

    return true
  }

  /**
   * Fetches the contact from database
   *
   * @param {string} id - the contact id
   * @returns {Promise<Contact | undefined>} - the contact if found, undefined otherwise
   */
  private _getContact = async (id: string): Promise<Contact | undefined> => {
    try {
      const contact = (await this.db.get('contacts', ['*'], {
        id
      })) as unknown as Contact[]

      if (!contact || !contact.length) {
        throw new Error('Failed to get contact')
      }

      return contact[0]
    } catch (error) {
      this.logger.error('Failed to check contact existance')
    }
  }

  /**
   * Fetches the addressbook from database
   *
   * @param {string} id - the addressbook id
   * @returns {Promise<AddressBook | undefined>} - the addressbook if found, undefined otherwise
   */
  private _getAddressbook = async (
    id: string
  ): Promise<AddressBook | undefined> => {
    try {
      const addressbook = (await this.db.get('addressbooks', ['*'], {
        id
      })) as unknown as AddressBook[]

      if (!addressbook || !addressbook.length) {
        throw new Error('Failed to get addressbook')
      }

      return addressbook[0]
    } catch (error) {
      this.logger.error('Failed to check addressbook existance')
    }
  }
}
