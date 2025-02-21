import type { NextFunction, Response, Request } from 'express'

export interface Contact {
  id: string
  mxid: string
  display_name: string
  active: number
  addressbook_id: string
}

export interface AddressBook {
  id: string
  owner: string
}

export interface ContactCreationPayload {
  mxid: string
  display_name: string
  active: number
}

export interface ContactCreationRequest {
  contacts: ContactCreationPayload[]
}

export interface ContactUpdatePayload {
  mxid: string
  display_name: string
  active: number
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
   * Create a new addressbook with initial contact list
   */
  create(
    owner: string,
    contacts?: ContactCreationPayload[]
  ): Promise<AddressbookListResponse | undefined>

  /**
   * Deletes an addressbook
   */
  delete(owner: string): Promise<void>

  /**
   * Add a new contact to an existing addressbook
   */
  addContact(
    addressbookId: string,
    contact: ContactCreationPayload
  ): Promise<Contact | undefined>

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
}

export type ApiRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void

export interface IAddressbookApiController {
  listAddressbooks: ApiRequestHandler
  createAddressbook: ApiRequestHandler
  deleteAddressbook: ApiRequestHandler
  addContact: ApiRequestHandler
  updateContact: ApiRequestHandler
  deleteContact: ApiRequestHandler
}
