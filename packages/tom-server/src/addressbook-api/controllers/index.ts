import { TwakeLogger } from '@twake-chat/logger'
import { AuthRequest, TwakeDB } from '../../types'
import type {
  EnrichedContact,
  IAddressbookApiController,
  IAddressbookService
} from '../types'
import { AddressbookService } from '../services'
import type { NextFunction, Response } from 'express'
import type { IUserInfoService } from '../../user-info-api/types'

export default class AddressbookApiController
  implements IAddressbookApiController
{
  private readonly service: IAddressbookService

  constructor(
    db: TwakeDB,
    private readonly logger: TwakeLogger,
    addressbookService?: IAddressbookService,
    private readonly userInfoService?: IUserInfoService
  ) {
    this.service = addressbookService ?? new AddressbookService(db, logger)
  }

  /**
   * Enriches contacts with additional user information from UserInfoService.
   *
   * @param {Contact[]} contacts - Array of contacts to enrich
   * @param {string} viewer - The viewer's user ID for visibility checks
   * @returns {Promise<EnrichedContact[]>} Array of enriched contacts
   */
  private async _enrichContacts(
    contacts: { mxid: string; [key: string]: any }[],
    viewer: string
  ): Promise<EnrichedContact[]> {
    if (!this.userInfoService || contacts.length === 0) {
      this.logger.debug(
        '[AddressbookApiController._enrichContacts] Skipping enrichment - no service or no contacts',
        {
          hasUserInfoService: !!this.userInfoService,
          contactsCount: contacts.length
        }
      )
      return contacts.map((c) => ({ ...c } as EnrichedContact))
    }

    const mxids = contacts.map((c) => c.mxid)

    try {
      this.logger.debug(
        `[AddressbookApiController._enrichContacts] Enriching ${mxids.length} contacts`
      )
      const userInfoMap = await this.userInfoService.getBatch(mxids, viewer)

      const enrichedContacts = contacts.map((contact) => {
        const userInfo = userInfoMap.get(contact.mxid)
        const enriched: EnrichedContact = { ...contact } as EnrichedContact

        if (userInfo) {
          // Enrichment fields
          enriched.avatar_url = userInfo.avatar_url || ''
          enriched.last_name = userInfo.last_name || ''
          enriched.first_name = userInfo.first_name || ''
          enriched.emails = userInfo.emails || []
          enriched.phones = userInfo.phones || []
          enriched.language = userInfo.language || ''
          enriched.timezone = userInfo.timezone || ''
          if (userInfo.workplaceFqdn)
            enriched.workplaceFqdn = userInfo.workplaceFqdn

          // Deprecated fields for backward compatibility
          enriched.displayName = userInfo.display_name || ''
          enriched.cn = userInfo.display_name || ''
          enriched.sn = userInfo.sn || ''
          enriched.givenName = userInfo.first_name || ''
          enriched.givenname = userInfo.first_name || ''
          enriched.mail = userInfo.emails?.at(0) || ''
          enriched.mobile = userInfo.phones?.at(0) || ''
        }

        return enriched
      })

      this.logger.info(
        `[AddressbookApiController._enrichContacts] Enriched ${enrichedContacts.length} contacts with user info`
      )
      return enrichedContacts
    } catch (error: any) {
      this.logger.error(
        '[AddressbookApiController._enrichContacts] Enrichment failed, returning non-enriched contacts',
        {
          message: error.message,
          stack: error.stack
        }
      )
      return contacts.map((c) => ({ ...c } as EnrichedContact))
    }
  }

  /**
   * Lists connected user addressbook
   *
   * @param {AuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public listAddressbook = async (
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

      const addressbook = await this.service.list(owner)

      // Enrich contacts with user info
      const enrichedContacts = await this._enrichContacts(
        addressbook.contacts,
        owner
      )

      res.status(200).json({
        ...addressbook,
        contacts: enrichedContacts
      })
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
