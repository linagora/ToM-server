import { v7 as uuidv7 } from 'uuid'
import { TwakeLogger } from '@twake/logger'
import { TwakeDB } from '../../types'
import type {
  AddressBook,
  AddressbookListResponse,
  Contact,
  ContactCreationPayload,
  ContactUpdatePayload,
  IAddressbookService
} from '../types'

export class AddressbookService implements IAddressbookService {
  constructor(
    private readonly db: TwakeDB,
    private readonly logger: TwakeLogger
  ) {
    this.logger.info('[AddressbookService] Initialized.', {})
  }

  /**
   * list the addressbook of an owner
   *
   * @param {string} owner - The owner of the addressbook
   * @returns {Promise<AddressbookListResponse[]>}
   */
  public list = async (owner: string): Promise<AddressbookListResponse> => {
    this.logger.silly('[AddressbookService.list] Entering method.', { owner })
    try {
      this.logger.debug(
        '[AddressbookService.list] Attempting to get or create user addressbook.'
      )
      const userAddressbook = await this._getOrCreateUserAddressBook(owner)
      this.logger.info('[AddressbookService.list] Listing addressbook.', {
        addressbookId: userAddressbook.id,
        owner
      })

      this.logger.debug(
        '[AddressbookService.list] Attempting to list contacts for addressbook.'
      )
      const contacts = await this._listAddressbookContacts(userAddressbook.id)
      this.logger.info(
        `[AddressbookService.list] Got ${contacts.length} contacts for owner.`,
        { owner, contactsCount: contacts.length }
      )
      this.logger.silly(
        `[AddressbookService.list] Retrieved contacts: ${JSON.stringify(
          contacts
        )}`
      )

      this.logger.silly('[AddressbookService.list] Exiting method (success).')
      return {
        id: userAddressbook.id,
        owner,
        contacts
      }
    } catch (error: any) {
      this.logger.error(
        '[AddressbookService.list] Failed to list addressbook.',
        {
          message: error.message,
          stack: error.stack,
          errorName: error.name
        }
      )
      this.logger.silly('[AddressbookService.list] Exiting method (error).')
      return {
        id: '',
        owner,
        contacts: []
      }
    }
  }

  /**
   * Deletes an addressbook
   *
   * @param {string} owner - The id of the addressbook
   * @returns {Promise<void>}
   */
  public delete = async (owner: string): Promise<void> => {
    this.logger.silly('[AddressbookService.delete] Entering method.', { owner })
    try {
      this.logger.debug(
        '[AddressbookService.delete] Fetching addressbook by owner.'
      )
      const userAddressbook = (await this.db.get('addressbooks', ['id'], {
        owner
      })) as unknown as AddressBook[]

      if (!userAddressbook || !userAddressbook.length) {
        this.logger.warn(
          '[AddressbookService.delete] Addressbook not found for owner, nothing to delete.',
          { owner }
        )
        throw new Error('Addressbook not found') // Re-throwing for consistent error flow
      }

      const id = userAddressbook[0].id as string
      this.logger.info(
        '[AddressbookService.delete] Found addressbook, proceeding with deletion.',
        { addressbookId: id, owner }
      )

      this.logger.debug(
        '[AddressbookService.delete] Deleting contacts associated with addressbook.'
      )
      await this.db.deleteEqual('contacts', 'addressbook_id', id)
      this.logger.debug(
        '[AddressbookService.delete] Contacts deleted. Deleting addressbook entry.'
      )
      await this.db.deleteEqual('addressbooks', 'id', id)
      this.logger.info(
        '[AddressbookService.delete] Addressbook and associated contacts deleted successfully.',
        { addressbookId: id, owner }
      )
      this.logger.silly('[AddressbookService.delete] Exiting method (success).')
    } catch (error: any) {
      this.logger.error(
        '[AddressbookService.delete] Failed to delete addressbook.',
        {
          message: error.message,
          stack: error.stack,
          errorName: error.name
        }
      )
      this.logger.silly('[AddressbookService.delete] Exiting method (error).')
      throw error
    }
  }

  /**
   * Get a contact by id
   *
   * @param {string} contactId - the contact id
   */
  public getContact = async (
    contactId: string
  ): Promise<Contact | undefined> => {
    this.logger.silly('[AddressbookService.getContact] Entering method.', {
      contactId
    })
    try {
      this.logger.debug(
        '[AddressbookService.getContact] Querying database for contact.',
        { contactId }
      )
      const queryResult = (await this.db.get('contacts', ['*'], {
        id: contactId
      })) as unknown as Contact[]

      if (!queryResult || !queryResult.length) {
        this.logger.warn('[AddressbookService.getContact] Contact not found.', {
          contactId
        })
        throw new Error('Contact not found')
      }

      const contact = this._normalizeContact(queryResult[0])
      this.logger.info('[AddressbookService.getContact] Contact found.', {
        contactId,
        contactMxid: contact.mxid
      })
      this.logger.silly(
        `[AddressbookService.getContact] Retrieved contact: ${JSON.stringify(
          contact
        )}`
      )
      this.logger.silly(
        '[AddressbookService.getContact] Exiting method (success).'
      )
      return contact
    } catch (error: any) {
      this.logger.error(
        '[AddressbookService.getContact] Failed to get contact.',
        {
          contactId,
          message: error.message,
          stack: error.stack,
          errorName: error.name
        }
      )
      this.logger.silly(
        '[AddressbookService.getContact] Exiting method (error).'
      )
      return undefined
    }
  }

  /**
   * Add a contact to an addressbook
   *
   * @param {string} owner - The id of the addressbook
   * @param {ContactCreationPayload[]} contacts - The contacts to add
   * @returns {Promise<AddressbookListResponse>}
   */
  public addContacts = async (
    owner: string,
    contacts?: ContactCreationPayload[]
  ): Promise<AddressbookListResponse | undefined> => {
    this.logger.silly('[AddressbookService.addContacts] Entering method.', {
      owner,
      contactsCount: contacts?.length ?? 0
    })
    try {
      let createdContacts: Contact[] = []
      this.logger.debug(
        '[AddressbookService.addContacts] Getting or creating user addressbook.'
      )
      const addressbook = await this._getOrCreateUserAddressBook(owner)
      const { id } = addressbook
      this.logger.info(
        '[AddressbookService.addContacts] Retrieved addressbook for adding contacts.',
        { addressbookId: id, owner }
      )

      if (contacts && contacts.length > 0) {
        this.logger.debug(
          `[AddressbookService.addContacts] Processing ${contacts.length} contacts for addition.`
        )
        for (const contact of contacts) {
          this.logger.silly(
            '[AddressbookService.addContacts] Checking if contact already exists.',
            { contactMxid: contact.mxid, addressbookId: id }
          )
          const exists = await this._checkIfContactExists(contact, id)

          if (!exists) {
            this.logger.debug(
              '[AddressbookService.addContacts] Contact does not exist, inserting new contact.',
              { contactMxid: contact.mxid }
            )
            const createdContact = await this._insertContact(contact, id)

            if (createdContact && createdContact.id) {
              createdContacts.push(createdContact)
              this.logger.info(
                '[AddressbookService.addContacts] Successfully created new contact.',
                {
                  contactId: createdContact.id,
                  contactMxid: createdContact.mxid
                }
              )
            } else {
              this.logger.error(
                '[AddressbookService.addContacts] Failed to create contact (insert returned no ID).',
                { contactPayload: JSON.stringify(contact) }
              )
            }
          } else {
            this.logger.info(
              '[AddressbookService.addContacts] Contact already exists, skipping insertion.',
              { contactMxid: contact.mxid }
            )
          }
        }
      } else {
        this.logger.debug(
          '[AddressbookService.addContacts] No contacts provided in payload.'
        )
      }

      this.logger.info(
        '[AddressbookService.addContacts] Finished processing contacts.',
        { createdContactsCount: createdContacts.length }
      )
      this.logger.silly(
        '[AddressbookService.addContacts] Exiting method (success).'
      )
      return {
        id,
        owner,
        contacts: createdContacts
      }
    } catch (error: any) {
      this.logger.error(
        '[AddressbookService.addContacts] Failed to add contacts.',
        {
          message: error.message,
          stack: error.stack,
          errorName: error.name
        }
      )
      this.logger.silly(
        '[AddressbookService.addContacts] Exiting method (error).'
      )
      return undefined
    }
  }

  /**
   * Update an existing contact
   *
   * @param {string} id - The id of the contact
   * @param {ContactUpdatePayload} contact - The contact to update
   * @returns {Promise<Contact>}
   */
  public updateContact = async (
    id: string,
    contact: ContactUpdatePayload
  ): Promise<Contact | undefined> => {
    this.logger.silly('[AddressbookService.updateContact] Entering method.', {
      contactId: id,
      updatePayload: JSON.stringify(contact)
    })
    try {
      const { display_name, active = undefined } = contact

      const updatePayload = {
        display_name,
        ...(active !== undefined ? { active: +active } : {})
      }
      this.logger.debug(
        '[AddressbookService.updateContact] Prepared update payload for contact.',
        { contactId: id, payload: JSON.stringify(updatePayload) }
      )

      const updatedContact = (await this.db.update(
        'contacts',
        updatePayload,
        'id',
        id
      )) as unknown as Contact[]

      if (!updatedContact || !updatedContact.length) {
        this.logger.warn(
          '[AddressbookService.updateContact] No contact found or updated.',
          { contactId: id }
        )
        throw new Error('Contact not found or failed to update')
      }

      const resultContact = this._normalizeContact(updatedContact[0])
      this.logger.info(
        '[AddressbookService.updateContact] Contact updated successfully.',
        {
          contactId: id,
          updatedMxid: resultContact.mxid
        }
      )
      this.logger.silly(
        `[AddressbookService.updateContact] Updated contact details: ${JSON.stringify(
          resultContact
        )}`
      )
      this.logger.silly(
        '[AddressbookService.updateContact] Exiting method (success).'
      )
      return resultContact
    } catch (error: any) {
      this.logger.error(
        '[AddressbookService.updateContact] Failed to update contact.',
        {
          contactId: id,
          message: error.message,
          stack: error.stack,
          errorName: error.name
        }
      )
      this.logger.silly(
        '[AddressbookService.updateContact] Exiting method (error).'
      )
      return undefined
    }
  }

  /**
   * Deletes a contact from an addressbook
   *
   * @param {string} contactId - The id of the contact
   * @returns {Promise<void>}
   */
  public deleteContact = async (contactId: string): Promise<void> => {
    this.logger.silly('[AddressbookService.deleteContact] Entering method.', {
      contactId
    })
    try {
      this.logger.debug(
        '[AddressbookService.deleteContact] Deleting contact from database.',
        { contactId }
      )
      await this.db.deleteEqual('contacts', 'id', contactId)
      this.logger.info(
        '[AddressbookService.deleteContact] Contact deleted successfully.',
        { contactId }
      )
      this.logger.silly(
        '[AddressbookService.deleteContact] Exiting method (success).'
      )
    } catch (error: any) {
      this.logger.error(
        '[AddressbookService.deleteContact] Failed to delete contact.',
        {
          contactId,
          message: error.message,
          stack: error.stack,
          errorName: error.name
        }
      )
      this.logger.silly(
        '[AddressbookService.deleteContact] Exiting method (error).'
      )
      throw error
    }
  }

  /**
   * Insert a contact into the database
   *
   * @param {ContactCreationPayload} contact - The contact to insert
   * @param {string} addressbookId - The addressbook id
   * @returns Promise<Contact | undefined>
   */
  private _insertContact = async (
    contact: ContactCreationPayload,
    addressbookId: string
  ): Promise<Contact | undefined> => {
    this.logger.silly('[AddressbookService._insertContact] Entering method.', {
      addressbookId,
      contactMxid: contact.mxid
    })
    try {
      const { display_name, mxid } = contact
      const id = uuidv7()
      this.logger.debug(
        '[AddressbookService._insertContact] Generated new UUID for contact.',
        { contactId: id }
      )

      this.logger.debug(
        '[AddressbookService._insertContact] Inserting contact into database.',
        { contactId: id, addressbookId, mxid }
      )
      const created = (await this.db.insert('contacts', {
        mxid,
        display_name,
        active: 1,
        id,
        addressbook_id: addressbookId
      })) as unknown as Contact[]

      if (!created || !created.length) {
        this.logger.error(
          '[AddressbookService._insertContact] Database insert returned no created contact.',
          { contactId: id, addressbookId, mxid }
        )
        throw new Error('Failed to insert contact: no data returned')
      }

      const resultContact = this._normalizeContact(created[0])
      this.logger.info(
        '[AddressbookService._insertContact] Contact inserted successfully.',
        { contactId: resultContact.id, contactMxid: resultContact.mxid }
      )
      this.logger.silly(
        `[AddressbookService._insertContact] Inserted contact details: ${JSON.stringify(
          resultContact
        )}`
      )
      this.logger.silly(
        '[AddressbookService._insertContact] Exiting method (success).'
      )
      return resultContact
    } catch (error: any) {
      this.logger.error(
        '[AddressbookService._insertContact] Failed to insert contact.',
        {
          addressbookId,
          contactMxid: contact.mxid,
          message: error.message,
          stack: error.stack,
          errorName: error.name
        }
      )
      this.logger.silly(
        '[AddressbookService._insertContact] Exiting method (error).'
      )
      return undefined
    }
  }

  /**
   * List the contacts of an addressbook
   *
   * @param {string} id - The id of the addressbook
   * @returns {Promise<Contact[]>}
   */
  private _listAddressbookContacts = async (id: string): Promise<Contact[]> => {
    this.logger.silly(
      '[AddressbookService._listAddressbookContacts] Entering.',
      { addressbookId: id }
    )

    // Fetch from DB with localized error handling
    let rawContacts: Contact[]
    try {
      rawContacts = await this._fetchContactsFromDb(id)
    } catch (error: any) {
      this.logger.error(
        '[AddressbookService._listAddressbookContacts] DB fetch failed.',
        {
          addressbookId: id,
          message: error.message
        }
      )
      return []
    }

    // Filter valid contacts (filters both invalid IDs and mxids)
    const validContacts = rawContacts.filter((c) =>
      this._validateContactData(c)
    )
    const invalidCount = rawContacts.length - validContacts.length

    if (invalidCount > 0) {
      this.logger.warn(
        '[AddressbookService._listAddressbookContacts] Filtered out invalid contacts.',
        { addressbookId: id, invalidCount, totalContacts: rawContacts.length }
      )
    }

    // Early return if no valid contacts
    if (validContacts.length === 0) {
      this.logger.info(
        '[AddressbookService._listAddressbookContacts] No valid contacts found.',
        { addressbookId: id, rawCount: rawContacts.length }
      )
      this.logger.silly(
        '[AddressbookService._listAddressbookContacts] Exiting (no valid contacts).',
        { addressbookId: id }
      )
      return []
    }

    // Normalize and process
    const normalized = validContacts.map((c) => this._normalizeContact(c))

    // Sort by ID (UUID v7 timestamp) to keep earliest created contacts during deduplication
    const sortedById = this._sortByStringField(normalized, 'id', true)

    // Deduplicate by mxid (keep first occurrence = earliest created)
    const deduplicated = this._deduplicateByMxid(sortedById)
    const duplicateCount = normalized.length - deduplicated.length

    if (duplicateCount > 0) {
      this.logger.info(
        '[AddressbookService._listAddressbookContacts] Removed duplicate contacts.',
        { addressbookId: id, duplicatesRemoved: duplicateCount }
      )
    }

    // Sort by display name for final output
    const result = this._sortByStringField(deduplicated, 'display_name', true)

    this.logger.info(
      '[AddressbookService._listAddressbookContacts] Contacts retrieved and sanitized.',
      {
        addressbookId: id,
        rawCount: rawContacts.length,
        validCount: result.length,
        invalidFiltered: invalidCount,
        duplicatesRemoved: duplicateCount
      }
    )

    this.logger.silly(
      '[AddressbookService._listAddressbookContacts] Exiting.',
      { addressbookId: id }
    )
    return result
  }

  /**
   * Validates that a contact has all required fields with correct types.
   *
   * @param {Contact} contact - The contact to validate
   * @returns {boolean} True if contact has valid id and mxid, false otherwise
   */
  private _validateContactData(contact: Contact): boolean {
    return !!(
      contact?.id &&
      typeof contact.id === 'string' &&
      contact?.mxid &&
      typeof contact.mxid === 'string'
    )
  }

  /**
   * Normalizes contact data by converting active field to boolean.
   *
   * @param {Contact} contact - The contact to normalize
   * @returns {Contact} Normalized contact with active as boolean
   */
  private _normalizeContact(contact: Contact): Contact {
    return {
      ...contact,
      active: !!contact.active
    }
  }

  /**
   * Generic string field sorter with null/empty handling.
   * Sorts contacts by a specified string field, with configurable handling of empty values.
   *
   * @param {Contact[]} contacts - Array of contacts to sort
   * @param {keyof Contact} field - Field name to sort by
   * @param {boolean} emptyLast - If true, empty values sorted to end; if false, to beginning
   * @returns {Contact[]} New sorted array (does not mutate original)
   */
  private _sortByStringField(
    contacts: Contact[],
    field: keyof Contact,
    emptyLast: boolean = true
  ): Contact[] {
    return [...contacts].sort((a, b) => {
      const valueA = a?.[field] as string | null | undefined
      const valueB = b?.[field] as string | null | undefined

      const strA = valueA ?? ''
      const strB = valueB ?? ''

      // Handle empty values
      if (!strA && !strB) return 0
      if (!strA) return emptyLast ? 1 : -1
      if (!strB) return emptyLast ? -1 : 1

      return strA.localeCompare(strB)
    })
  }

  /**
   * Removes duplicate contacts based on mxid, keeping the first occurrence.
   * Assumes contacts are already sorted by creation time (UUID v7 timestamp).
   *
   * @param {Contact[]} contacts - Array of contacts (should be sorted by id first)
   * @returns {Contact[]} Deduplicated array keeping earliest created contact per mxid
   */
  private _deduplicateByMxid(contacts: Contact[]): Contact[] {
    const seen = new Set<string>()

    return contacts.filter((contact) => {
      if (seen.has(contact.mxid)) return false
      seen.add(contact.mxid)
      return true
    })
  }

  /**
   * Fetches contacts from database and validates response type.
   *
   * @param {string} addressbookId - The addressbook ID to fetch contacts for
   * @returns {Promise<Contact[]>} Array of contacts from database
   * @throws {Error} If database returns non-array value
   */
  private async _fetchContactsFromDb(
    addressbookId: string
  ): Promise<Contact[]> {
    const contacts = (await this.db.get('contacts', ['*'], {
      addressbook_id: addressbookId
    })) as unknown as Contact[]

    if (!Array.isArray(contacts)) {
      this.logger.error(
        '[AddressbookService._fetchContactsFromDb] Database returned invalid data type.',
        { addressbookId, receivedType: typeof contacts }
      )
      throw new Error('Invalid database response: expected array of contacts')
    }

    return contacts
  }

  /**
   * Fetches the user addressbook or create a new one if it does not exist
   *
   * @param {string} owner
   * @returns {Promise<AddressBook>}
   */
  private readonly _getOrCreateUserAddressBook = async (
    owner: string
  ): Promise<AddressBook> => {
    this.logger.silly(
      '[AddressbookService._getOrCreateUserAddressBook] Entering method.',
      {
        owner
      }
    )
    if (owner.length === 0) {
      this.logger.error(
        '[AddressbookService._getOrCreateUserAddressBook] Owner is required to get or create addressbook.'
      )
      throw new Error('Owner is required')
    }

    let userAddressbook: AddressBook | undefined

    // Try fetching the existing address book
    try {
      this.logger.debug(
        '[AddressbookService._getOrCreateUserAddressBook] Attempting to fetch existing user addressbook.'
      )
      userAddressbook = await this._getUserAddressBook(owner)
      if (userAddressbook) {
        this.logger.info(
          '[AddressbookService._getOrCreateUserAddressBook] Existing addressbook found.',
          { addressbookId: userAddressbook.id }
        )
        this.logger.silly(
          '[AddressbookService._getOrCreateUserAddressBook] Exiting method (success).'
        )
        return userAddressbook
      }
    } catch (error: any) {
      this.logger.debug(
        '[AddressbookService._getOrCreateUserAddressBook] No existing addressbook found, will create one.',
        { owner }
      )
    }

    // Create if it doesn't exist - using retry logic to handle race conditions
    if (userAddressbook == null) {
      const maxRetries = 3
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          this.logger.info(
            '[AddressbookService._getOrCreateUserAddressBook] Creating addressbook (attempt ' +
              (attempt + 1) +
              '/' +
              maxRetries +
              ')'
          )
          userAddressbook = await this._createUserAddressBook(owner)

          if (userAddressbook != null) {
            this.logger.info(
              '[AddressbookService._getOrCreateUserAddressBook] Successfully created new addressbook.',
              { addressbookId: userAddressbook.id }
            )
            break
          }
        } catch (error: any) {
          // If creation failed due to duplicate key constraint, try fetching again
          if (this._isDuplicateKeyError(error)) {
            this.logger.warn(
              '[AddressbookService._getOrCreateUserAddressBook] Duplicate key error on attempt ' +
                (attempt + 1) +
                ', fetching existing addressbook.',
              { owner, error: error.message }
            )

            try {
              userAddressbook = await this._getUserAddressBook(owner)
              if (userAddressbook) {
                this.logger.info(
                  '[AddressbookService._getOrCreateUserAddressBook] Found addressbook after duplicate error.',
                  { addressbookId: userAddressbook.id }
                )
                break
              }
            } catch (fetchError: any) {
              this.logger.warn(
                '[AddressbookService._getOrCreateUserAddressBook] Failed to fetch after duplicate error.',
                { owner, error: fetchError.message }
              )
            }

            // Wait before retry (exponential backoff: 100ms, 200ms, 400ms)
            if (attempt < maxRetries - 1) {
              const delayMs = Math.pow(2, attempt) * 100
              this.logger.debug(
                '[AddressbookService._getOrCreateUserAddressBook] Waiting ' +
                  delayMs +
                  'ms before retry'
              )
              await new Promise((resolve) => setTimeout(resolve, delayMs))
            }
          } else {
            // For non-duplicate errors, rethrow immediately
            this.logger.error(
              '[AddressbookService._getOrCreateUserAddressBook] Non-duplicate error during creation.',
              { owner, error: error.message, stack: error.stack }
            )
            this.logger.silly(
              '[AddressbookService._getOrCreateUserAddressBook] Exiting method (error).'
            )
            throw error
          }
        }
      }

      // Throw an error if we couldn't get or create an addressbook after all retries
      if (userAddressbook == null) {
        this.logger.error(
          '[AddressbookService._getOrCreateUserAddressBook] Failed to get or create addressbook after all attempts.'
        )
        this.logger.silly(
          '[AddressbookService._getOrCreateUserAddressBook] Exiting method (error after retries).'
        )
        throw new Error(
          'Failed to get or create addressbook after multiple attempts'
        )
      }
    }

    this.logger.silly(
      '[AddressbookService._getOrCreateUserAddressBook] Exiting method (success).'
    )
    return userAddressbook
  }

  /**
   * Helper to detect duplicate key errors from database
   *
   * @param {any} error - The error to check
   * @returns {boolean} True if this is a duplicate key error
   */
  private _isDuplicateKeyError(error: any): boolean {
    if (!error) return false

    const message = error.message?.toLowerCase() || ''

    // SQLite duplicate key errors
    if (
      message.includes('unique constraint') ||
      message.includes('sqlite_constraint')
    ) {
      return true
    }

    // PostgreSQL duplicate key errors
    if (message.includes('duplicate key') || error.code === '23505') {
      return true
    }

    return false
  }

  /**
   * Fetches the user addressbook
   *
   * @param {string} owner
   * @returns {Promise<AddressBook | undefined>}
   */
  private _getUserAddressBook = async (
    owner: string
  ): Promise<AddressBook | undefined> => {
    this.logger.silly(
      '[AddressbookService._getUserAddressBook] Entering method.',
      {
        owner
      }
    )
    try {
      this.logger.debug(
        '[AddressbookService._getUserAddressBook] Querying database for addressbook by owner.',
        { owner }
      )
      const userAddressbook = (await this.db.get('addressbooks', ['*'], {
        owner
      })) as unknown as AddressBook[]

      if (!userAddressbook || !userAddressbook.length) {
        this.logger.info(
          '[AddressbookService._getUserAddressBook] Addressbook not found for owner.',
          { owner }
        )
        // Throwing an error here to be caught by _getOrCreateUserAddressBook logic
        throw new Error('Addressbook not found')
      }

      const result = userAddressbook[0]
      this.logger.info(
        '[AddressbookService._getUserAddressBook] Addressbook found.',
        {
          addressbookId: result.id,
          owner
        }
      )
      this.logger.silly(
        `[AddressbookService._getUserAddressBook] Retrieved addressbook: ${JSON.stringify(
          result
        )}`
      )
      this.logger.silly(
        '[AddressbookService._getUserAddressBook] Exiting method (success).'
      )
      return result
    } catch (error: any) {
      this.logger.error(
        '[AddressbookService._getUserAddressBook] Failed to get user addressbook.',
        {
          owner,
          message: error.message,
          stack: error.stack,
          errorName: error.name
        }
      )
      this.logger.silly(
        '[AddressbookService._getUserAddressBook] Exiting method (error).'
      )
      return undefined
    }
  }

  /**
   * Creates a new addressbook for a user
   *
   * @param {string} owner
   * @returns {Promise<AddressBook | undefined>}
   */
  private _createUserAddressBook = async (
    owner: string
  ): Promise<AddressBook> => {
    this.logger.silly(
      '[AddressbookService._createUserAddressBook] Entering method.',
      {
        owner
      }
    )
    const id = uuidv7()
    this.logger.debug(
      '[AddressbookService._createUserAddressBook] Generated new UUID for addressbook.',
      { addressbookId: id }
    )
    this.logger.debug(
      '[AddressbookService._createUserAddressBook] Inserting new addressbook into database.',
      { owner, addressbookId: id }
    )
    const addressbook = (await this.db.insert('addressbooks', {
      owner,
      id
    })) as unknown as AddressBook[]

    if (!addressbook || !addressbook.length) {
      this.logger.error(
        '[AddressbookService._createUserAddressBook] Database insert returned no created addressbook.',
        { owner, addressbookId: id }
      )
      throw new Error('Failed to create addressbook: no data returned')
    }

    const result = addressbook[0]
    this.logger.info(
      '[AddressbookService._createUserAddressBook] Addressbook created successfully.',
      { addressbookId: result.id, owner }
    )
    this.logger.silly(
      `[AddressbookService._createUserAddressBook] Created addressbook details: ${JSON.stringify(
        result
      )}`
    )
    this.logger.silly(
      '[AddressbookService._createUserAddressBook] Exiting method (success).'
    )
    return result
  }

  /**
   * Checks if a contact already exists within addressbook
   *
   * @param {ContactCreationPayload} contact - The contact to check
   * @param {string} addressbookId - The addressbook id
   * @returns {Promise<boolean>}
   */
  private _checkIfContactExists = async (
    contact: ContactCreationPayload,
    addressbookId: string
  ): Promise<boolean> => {
    this.logger.silly(
      '[AddressbookService._checkIfContactExists] Entering method.',
      {
        addressbookId,
        contactMxid: contact.mxid
      }
    )
    try {
      const { mxid, display_name } = contact

      this.logger.debug(
        '[AddressbookService._checkIfContactExists] Querying database to check for existing contact.',
        { addressbookId, mxid, display_name }
      )
      const contactExists = (await this.db.get('contacts', ['*'], {
        mxid,
        display_name,
        addressbook_id: addressbookId
      })) as unknown as Contact[]

      const exists = contactExists.length > 0
      this.logger.info(
        '[AddressbookService._checkIfContactExists] Contact existence check complete.',
        { addressbookId, mxid, exists }
      )
      this.logger.silly(
        '[AddressbookService._checkIfContactExists] Exiting method (success).'
      )
      return exists
    } catch (error: any) {
      this.logger.error(
        '[AddressbookService._checkIfContactExists] Failed to check if contact exists.',
        {
          addressbookId,
          contactMxid: contact.mxid,
          message: error.message,
          stack: error.stack,
          errorName: error.name
        }
      )
      this.logger.silly(
        '[AddressbookService._checkIfContactExists] Exiting method (error).'
      )
      return false
    }
  }
}
