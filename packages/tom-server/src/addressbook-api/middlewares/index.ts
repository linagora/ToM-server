import type { TwakeLogger } from '@twake/logger'
import type { AuthRequest, TwakeDB, Config } from '../../types'
import type { UserDB } from '@twake/matrix-identity-server'
import { toMatrixId, isMatrixId, getServerNameFromMatrixId } from '@twake/utils'
import type {
  AddressBook,
  Contact,
  ContactCreationRequest,
  ContactUpdatePayload,
  IAddressbookApiMiddleware,
  EnrichedAuthRequest,
  UserDBRow
} from '../types'
import type { IUserInfoService } from '../../user-info-api/types'
import type { NextFunction, Response } from 'express'

export default class AddressBookApiMiddleware
  implements IAddressbookApiMiddleware
{
  constructor(
    private readonly db: TwakeDB,
    private readonly logger: TwakeLogger,
    private readonly userDB: UserDB,
    private readonly config: Config,
    private readonly userInfoService: IUserInfoService
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

      if (!payload) {
        throw new Error('Missing body')
      }

      if (!payload.display_name) {
        res.status(400).json({ message: 'Missing display_name' })
        return
      }

      if (payload.active !== undefined) {
        if (typeof payload.active !== 'boolean') {
          res.status(400).json({ message: 'Invalid active value' })
          return
        }
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

  /**
   * Enriches addressbook contacts with users from userDB when additional features are enabled
   *
   * @param {EnrichedAuthRequest} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next function
   * @returns {Promise<void>}
   */
  public enrichWithUserDBContacts = async (
    req: EnrichedAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Check if additional features are enabled
      const enableAdditionalFeatures =
        process.env.ADDITIONAL_FEATURES === 'true' ||
        (this.config.additional_features as boolean)

      if (!enableAdditionalFeatures) {
        this.logger.debug(
          '[enrichWithUserDBContacts] Additional features disabled, skipping enrichment'
        )
        next()
        return
      }

      // Inject enrichment function into request
      req.enrichContacts = async (
        addressbookId: string,
        existingContacts: Contact[]
      ): Promise<Contact[]> => {
        // TODO: Implement LRU cache for userDB.getAll results to improve performance
        try {
          this.logger.debug('[enrichContacts] Fetching users from userDB')

          // Fetch all users from userDB
          const userDBRows = (await this.userDB.getAll('users', [
            'uid',
            'cn'
          ])) as unknown as UserDBRow[]

          if (
            !userDBRows ||
            !Array.isArray(userDBRows) ||
            userDBRows.length === 0
          ) {
            this.logger.info('[enrichContacts] No users found in userDB')
            return existingContacts
          }

          this.logger.debug(
            `[enrichContacts] Found ${userDBRows.length} users in userDB`
          )

          // Create a set of existing mxids for fast lookup
          const existingMxids = new Set(existingContacts.map((c) => c.mxid))

          // Transform and filter userDB users
          const userDBContacts: Contact[] = []
          for (const row of userDBRows) {
            if (!row.uid || !row.cn) {
              this.logger.silly(
                '[enrichContacts] Skipping userDB row with missing uid or cn'
              )
              continue
            }

            // Convert uid to mxid
            let mxid: string
            if (isMatrixId(row.uid)) {
              mxid = row.uid
            } else {
              try {
                mxid = toMatrixId(row.uid, this.config.server_name)
              } catch (e) {
                this.logger.warn(
                  `[enrichContacts] Failed to convert uid to mxid: ${row.uid}`,
                  e
                )
                continue
              }
            }

            // Skip if already in addressbook
            if (existingMxids.has(mxid)) {
              this.logger.silly(
                `[enrichContacts] Skipping ${mxid} - already in addressbook`
              )
              continue
            }

            // Create contact without id field
            userDBContacts.push({
              mxid,
              display_name: row.cn,
              active: true,
              addressbook_id: addressbookId
              // Intentionally no 'id' field
            } as Contact)
          }

          this.logger.info(
            `[enrichContacts] Added ${userDBContacts.length} contacts from userDB`
          )

          // Combine and sort by display_name
          const allContacts = [...existingContacts, ...userDBContacts]
          allContacts.sort((a, b) => {
            const nameA = a.display_name || ''
            const nameB = b.display_name || ''
            return nameA.localeCompare(nameB)
          })

          return allContacts
        } catch (error: any) {
          this.logger.error(
            '[enrichContacts] Failed to enrich with userDB contacts',
            {
              error: error.message,
              stack: error.stack
            }
          )
          // Return original contacts on error
          return existingContacts
        }
      }

      next()
    } catch (error) {
      next(error)
    }
  }

  /**
   * Enriches addressbook contacts with user information from userinfo service
   * Only enriches contacts from the local server (config.server_name)
   *
   * @param {EnrichedAuthRequest} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next function
   * @returns {Promise<void>}
   */
  public enrichWithUserInfo = async (
    req: EnrichedAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Inject enrichment function into request
      req.enrichWithUserInfo = async (
        contacts: Contact[],
        viewer?: string
      ): Promise<Contact[]> => {
        try {
          this.logger.debug(
            '[enrichWithUserInfo] Starting userinfo enrichment for contacts'
          )

          const userInfoMap = await this.userInfoService.getMany(
            contacts.map((c) => c.mxid),
            viewer
          )
          const enrichedContacts =
            userInfoMap.size > 0
              ? contacts.map((contact) => {
                  const userInfo = userInfoMap.get(contact.mxid)
                  if (!userInfo) {
                    this.logger.silly(
                      `[enrichWithUserInfo] No userinfo found for: ${contact.mxid}`
                    )
                    return contact
                  }

                  // Merge userinfo into contact
                  const enriched = {
                    ...contact,
                    ...userInfo,
                    mail: userInfo?.emails?.at(0) || '', // TODO: Deprecated kepping for backward compatibility
                    mobile: userInfo?.phones?.at(0) || '' // TODO: Deprecated kepping for backward compatibility
                  }

                  this.logger.silly(
                    `[enrichWithUserInfo] Enriched contact: ${contact.mxid}`
                  )
                  return enriched
                })
              : contacts

          this.logger.info(
            `[enrichWithUserInfo] Enriched ${enrichedContacts.length} contacts with userinfo`
          )
          return enrichedContacts
        } catch (error: any) {
          this.logger.error('[enrichWithUserInfo] Failed to enrich contacts', {
            error: error.message,
            stack: error.stack
          })
          return contacts // Return original on error
        }
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
