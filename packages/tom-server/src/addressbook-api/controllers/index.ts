import { TwakeLogger } from '@twake/logger'
import { AuthRequest, TwakeDB } from '../../types'
import type {
  IAddressbookApiController,
  IAddressbookService,
  EnrichedAuthRequest
} from '../types'
import { AddressbookService } from '../services'
import type { NextFunction, Response } from 'express'

export default class AddressbookApiController
  implements IAddressbookApiController
{
  private readonly service: IAddressbookService
  constructor(
    db: TwakeDB,
    private readonly logger: TwakeLogger,
    addressbookService?: IAddressbookService
  ) {
    this.service = addressbookService ?? new AddressbookService(db, logger)
  }

  /**
   * Lists connected user addressbook
   *
   * @param {EnrichedAuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public listAddressbook = async (
    req: EnrichedAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const owner = req.userId

      if (!owner) {
        this.logger.error(`missing owner`)
        throw new Error('Missing owner')
      }

      let addressbook = await this.service.list(owner)

      // Apply enrichment if middleware injected the function
      if (req.enrichContacts && typeof req.enrichContacts === 'function') {
        this.logger.debug('[listAddressbook] Applying contact enrichment')
        const enrichedContacts = await req.enrichContacts(
          addressbook.id,
          addressbook.contacts
        )
        addressbook = {
          ...addressbook,
          contacts: enrichedContacts
        }
      }

      // Apply userinfo enrichment if middleware injected the function
      if (
        req.enrichWithUserInfo &&
        typeof req.enrichWithUserInfo === 'function'
      ) {
        this.logger.debug('[listAddressbook] Applying userinfo enrichment')
        const enrichedContacts = await req.enrichWithUserInfo(
          addressbook.contacts,
          owner
        )
        addressbook = {
          ...addressbook,
          contacts: enrichedContacts
        }
      }

      res.status(200).json(addressbook)
    } catch (error) {
      next(error)
    }
  }

  /**
   * Deletes an addressbook
   *
   * @param {AuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public deleteAddressbook = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const owner = req.userId

      if (!owner) {
        this.logger.error(`missing owner`)
        throw new Error('Missing owner')
      }

      await this.service.delete(owner)
      res.status(200).json({ message: 'Addressbook deleted' })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Fetches a contact from an addressbook
   *
   * @param {AuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public fetchContact = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params

      const contact = await this.service.getContact(id)

      if (!contact) {
        this.logger.error('Contact not found')

        res.status(404).json({ message: 'Contact not found' })
        return
      }

      res.status(200).json(contact)
    } catch (error) {
      next(error)
    }
  }

  /**
   * Creates a new addressbook
   *
   * @param {AuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public addContacts = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const owner = req.userId

      if (!owner) {
        throw new Error('Missing owner')
      }

      const addressbook = await this.service.addContacts(
        owner,
        req.body.contacts
      )

      res.status(200).json(addressbook)
    } catch (error) {
      next(error)
    }
  }

  /**
   * Updates a contact
   *
   * @param {AuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public updateContact = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params
      const { body } = req

      const contact = await this.service.updateContact(id, body)

      if (!contact) {
        this.logger.error('Failed to update Contact')
        throw new Error('Failed to update Contact')
      }

      res.status(200).json(contact)
    } catch (error) {
      next(error)
    }
  }

  /**
   * Removes a contact
   *
   * @param {AuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public deleteContact = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params

      await this.service.deleteContact(id)
      res.status(200).json({ message: 'Contact deleted' })
    } catch (error) {
      next(error)
    }
  }
}
