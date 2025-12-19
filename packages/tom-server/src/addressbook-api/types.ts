import type { NextFunction, Response, Request } from 'express'
import type { UserDB } from '@twake/matrix-identity-server'
import type { AuthRequest } from '../types'

export interface Contact {
  id: string
  mxid: string
  display_name: string
  active: boolean
  addressbook_id: string
}

// Extend AuthRequest to include enrichment function
export interface EnrichedAuthRequest extends AuthRequest {
  enrichContacts?: (
    addressbookId: string,
    contacts: Contact[]
  ) => Promise<Contact[]>
  enrichWithUserInfo?: (
    contacts: Contact[],
    viewer?: string
  ) => Promise<Contact[]>
}

// Type for userDB row
export interface UserDBRow {
  uid: string
  cn: string
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

export interface IAddressbookService {
  /**
   * list the contacts of an addressbook
   */
  list(owner: string): Promise<AddressbookListResponse>

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
