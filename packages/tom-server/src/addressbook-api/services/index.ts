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
      const userAddressbook = await this.db.get('addressbooks', ['id'], {
        owner
      })

      if (!userAddressbook || !userAddressbook.length) {
        this.logger.info('Addressbook not found')

        throw new Error('Addressbook not found')
      }

      const addressbookId = userAddressbook[0].id as string

      const contacts = await this._listAddressbookContacts(addressbookId)

      return {
        id: addressbookId,
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
   * Create a new addressbook with initial contact list
   *
   * @param {string} owner - The owner of the addressbook
   * @param {ContactCreationPayload[]} contacts - The initial contact list
   * @returns {Promise<AddressbookListResponse | undefined>}
   */
  public create = async (
    owner: string,
    contacts?: ContactCreationPayload[]
  ): Promise<AddressbookListResponse | undefined> => {
    try {
      const id = uuidv7()
      const addressbook = await this.db.insert('addressbooks', {
        owner,
        id
      })

      if (!addressbook || !addressbook.length) {
        throw new Error()
      }

      if (contacts) {
        for (const contact of contacts) {
          await this._insertContact(contact, id)
        }
      }

      return {
        id,
        owner,
        contacts: await this._listAddressbookContacts(id)
      }
    } catch (error) {
      this.logger.error('Failed to create addressbook', { error })
    }
  }

  /**
   * Deletes an addressbook
   *
   * @param {string} owner - The id of the addressbook
   * @returns {Promise<void>}
   */
  delete = async (owner: string): Promise<void> => {
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
    }
  }

  /**
   * Add a contact to an addressbook
   *
   * @param {string} addressbookId - The id of the addressbook
   * @param {ContactCreationPayload} contact - The contact to add
   * @returns {Promise<Contact>}
   */
  addContact = async (
    addressbookId: string,
    contact: ContactCreationPayload
  ): Promise<Contact | undefined> => {
    try {
      const created = await this._insertContact(contact, addressbookId)

      if (!created) {
        throw new Error()
      }

      return created
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
  updateContact = async (
    id: string,
    contact: ContactUpdatePayload
  ): Promise<Contact | undefined> => {
    try {
      const updatedContact = (await this.db.update(
        'contacts',
        { ...contact, id },
        'id',
        id
      )) as unknown as Contact[]

      if (!updatedContact || !updatedContact.length) {
        throw new Error()
      }

      return updatedContact[0]
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
  deleteContact = async (contactId: string): Promise<void> => {
    try {
      await this.db.deleteEqual('contacts', 'id', contactId)
    } catch (error) {
      this.logger.error('Failed to delete contact', { error })
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
      const created = (await this.db.insert('contacts', {
        ...contact,
        addressbook_id: addressbookId
      })) as unknown as Contact[]

      return created[0]
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
      const contacts = (await this.db.get(
        'contacts',
        ['id', 'mxid', 'display_name', 'active'],
        {
          adressbook_id: id
        }
      )) as unknown as Contact[]

      return contacts
    } catch (error) {
      this.logger.error('Failed to list addressbook', { error })

      return []
    }
  }
}
