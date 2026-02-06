import type { NextFunction, Response, Request } from 'express'

export interface Contact {
  id: string
  mxid: string
  display_name: string
  active: boolean
  addressbook_id: string
}

export interface AddressBook {
  id: string
  owner: string
}

export interface ContactCreationPayload {
  mxid: string
  display_name: string
}

export interface ContactCreationRequest {
  contacts: ContactCreationPayload[]
}

export interface ContactUpdatePayload {
  mxid: string
  display_name: string
  active?: boolean
}

export interface AddressbookListResponse {
  id: string
  owner: string
  contacts: Contact[]
}

// Extended contact with enrichment data from UserInfoService
export interface EnrichedContact extends Contact {
  // Enrichment fields
  avatar_url?: string
  last_name?: string
  first_name?: string
  emails?: string[]
  phones?: string[]
  language?: string
  timezone?: string
  workplaceFqdn?: string
  // Deprecated fields for backward compatibility
  displayName?: string
  cn?: string
  sn?: string
  givenName?: string
  givenname?: string
  mail?: string
  mobile?: string
}

export interface IAddressbookService {
  /**
   * list the contacts of an addressbook
   * @param owner - The owner of the addressbook
   * @param includeUserDbContacts - Whether to include UserDB contacts (default: true)
   */
  list(
    owner: string,
    includeUserDbContacts?: boolean
  ): Promise<AddressbookListResponse>

  /**
   * Deletes an addressbook
   */
  delete(owner: string): Promise<void>

  /**
   * Add a new contact to an existing addressbook
   */
  addContacts(
    owner: string,
    contacts?: ContactCreationPayload[]
  ): Promise<AddressbookListResponse | undefined>

  /**
   * Update an existing contact
   */
  updateContact(
    id: string,
    contact: ContactUpdatePayload
  ): Promise<Contact | undefined>

  /**
   * Deletes a contact from an addressbook
   */
  deleteContact(contactId: string): Promise<void>

  /**
   * Fetch a contact from an addressbook
   */
  getContact(contactId: string): Promise<Contact | undefined>
}

export type ApiRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void

export interface IAddressbookApiController {
  listAddressbook: ApiRequestHandler
  deleteAddressbook: ApiRequestHandler
  addContacts: ApiRequestHandler
  updateContact: ApiRequestHandler
  deleteContact: ApiRequestHandler
  fetchContact: ApiRequestHandler
}

export interface IAddressbookApiMiddleware {
  validateContactsCreation: ApiRequestHandler
  validateContactUpdate: ApiRequestHandler
  checkContactOwnership: ApiRequestHandler
}
