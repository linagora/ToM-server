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
  ) {}

  /**
   * list the addressbook of an owner
   *
   * @param {string} owner - The owner of the addressbook
   * @returns {Promise<AddressbookListResponse[]>}
   */
  public list = async (owner: string): Promise<AddressbookListResponse> => {
    try {      
      const userAddressbook = await this._getOrCreateUserAddressBook(owner)
      this.logger.info('Listing addressbook', {
        addressbookId: userAddressbook.id,
        owner
      })

      const contacts = await this._listAddressbookContacts(userAddressbook.id)
      this.logger.info(`Got contacts ${JSON.stringify(contacts)} for ${owner}.`)

      return {
        id: userAddressbook.id,
        owner,
        contacts
      }
    } catch (error) {
      this.logger.error('Failed to list addressbook', { error })

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
    try {
      const userAddressbook = (await this.db.get('addressbooks', ['id'], {
        owner
      })) as unknown as AddressBook[]

      if (!userAddressbook || !userAddressbook.length) {
        throw new Error()
      }

      const id = userAddressbook[0].id as string

      await this.db.deleteEqual('contacts', 'addressbook_id', id)
      await this.db.deleteEqual('addressbooks', 'id', id)
    } catch (error) {
      this.logger.error('Failed to delete addressbook', { error })

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
    try {
      const queryResult = (await this.db.get('contacts', ['*'], {
        id: contactId
      })) as unknown as Contact[]

      if (!queryResult || !queryResult.length) {
        throw new Error('Contact not found')
      }

      return { ...queryResult[0], active: !!queryResult[0].active }
    } catch (error) {
      this.logger.error('Failed to get contact', { error })
    }
  }

  /**
   * Add a contact to an addressbook
   *
   * @param {string} owner - The id of the addressbook
   * @param {ContactCreationPayload} contacts - The contact to add
   * @returns {Promise<Contact>}
   */
  public addContacts = async (
    owner: string,
    contacts?: ContactCreationPayload[]
  ): Promise<AddressbookListResponse | undefined> => {
    try {
      let createdContacts: Contact[] = []
      const addressbook = await this._getOrCreateUserAddressBook(owner)

      const { id } = addressbook

      if (contacts) {
        for (const contact of contacts) {
          const exists = await this._checkIfContactExists(contact, id)

          if (!exists) {
            const createdContact = await this._insertContact(contact, id)

            if (createdContact && createdContact.id) {
              createdContacts.push(createdContact)
            } else {
              this.logger.error(`Failed to create contact`)
            }
          }
        }
      }

      return {
        id,
        owner,
        contacts: createdContacts
      }
    } catch (error) {
      this.logger.error('Failed to add contact', { error })
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
    try {
      const { display_name, active = undefined } = contact

      const updatedContact = (await this.db.update(
        'contacts',
        { display_name, ...(active !== undefined ? { active: +active } : {}) },
        'id',
        id
      )) as unknown as Contact[]

      if (!updatedContact || !updatedContact.length) {
        throw new Error()
      }

      return { ...updatedContact[0], active: !!updatedContact[0].active }
    } catch (error) {
      this.logger.error('Failed to update contact', { error })
    }
  }

  /**
   * Deletes a contact from an addressbook
   *
   * @param {string} contactId - The id of the contact
   * @returns {Promise<void>}
   */
  public deleteContact = async (contactId: string): Promise<void> => {
    try {
      await this.db.deleteEqual('contacts', 'id', contactId)
    } catch (error) {
      this.logger.error('Failed to delete contact', { error })

      throw error
    }
  }

  /**
   * Insert a contact into the database
   *
   * @param {Contact} contact - The contact to insert
   * @param {string} addressbookId - The addressbook id
   * @returns Promise<void>
   */
  private _insertContact = async (
    contact: ContactCreationPayload,
    addressbookId: string
  ): Promise<Contact | undefined> => {
    try {
      const { display_name, mxid } = contact
      const id = uuidv7()

      const created = (await this.db.insert('contacts', {
        mxid,
        display_name,
        active: 1,
        id,
        addressbook_id: addressbookId
      })) as unknown as Contact[]

      return { ...created[0], active: !!created[0].active }
    } catch (error) {
      this.logger.error('Failed to insert contact', { error })
    }
  }

  /**
   * List the contacts of an addressbook
   *
   * @param {string} id - The id of the addressbook
   * @returns {Promise<AddressbookListResponse>}
   */
  private _listAddressbookContacts = async (id: string): Promise<Contact[]> => {
    try {
      const contacts = (await this.db.get('contacts', ['*'], {
        addressbook_id: id
      })) as unknown as Contact[]

      return contacts.map((contact: Contact) => ({
        ...contact,
        active: !!contact.active
      }))
    } catch (error) {
      this.logger.error('Failed to list addressbook', { error })

      return []
    }
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
    if (owner.length === 0) {
      this.logger.error('Owner is required to get or create addressbook')
      throw new Error('Owner is required')
    }

    let userAddressbook: AddressBook | undefined

    // Try fetching the existing address book
    try {
      userAddressbook = await this._getUserAddressBook(owner)
    } catch (error) {
      this.logger.warn('Failed to fetch user addressbook, will try to create one', { error })
    }

    // Create if it doesn’t exist
    if (userAddressbook == null) {
      try {
        this.logger.info('Addressbook not found, creating one')
        userAddressbook = await this._createUserAddressBook(owner)
        if (userAddressbook == null) {
          this.logger.error('Failed to create addressbook')
          throw new Error('Failed to create addressbook')
        }
      } catch (error) {
        this.logger.error('Failed to create user addressbook', { error })
        throw error
      }
    }

    return userAddressbook
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
    try {
      const userAddressbook = (await this.db.get('addressbooks', ['*'], {
        owner
      })) as unknown as AddressBook[]

      if (!userAddressbook || !userAddressbook.length) {
        throw new Error('Addressbook not found')
      }

      return userAddressbook[0]
    } catch (error) {
      this.logger.error('Failed to get user addressbook', { error })
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
  ): Promise<AddressBook | undefined> => {
    try {
      const id = uuidv7()
      const addressbook = (await this.db.insert('addressbooks', {
        owner,
        id
      })) as unknown as AddressBook[]

      if (!addressbook || !addressbook.length) {
        throw new Error()
      }

      return addressbook[0]
    } catch (error) {
      this.logger.error('Failed to create user addressbook', { error })
    }
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
    try {
      const { mxid, display_name } = contact

      const contactExists = (await this.db.get('contacts', ['*'], {
        mxid,
        display_name,
        addressbook_id: addressbookId
      })) as unknown as Contact[]

      return contactExists.length > 0
    } catch (error) {
      this.logger.error('Failed to check if contact exists', { error })

      return false
    }
  }
}
