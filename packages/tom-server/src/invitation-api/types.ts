export interface IInvitationService {
  invite: (payload: invitationPayload, authToken: string) => Promise<void>
  accept: (token: string) => Promise<void>
  list: (userId: string) => Promise<Invitation[]>
  generateLink: (payload: invitationPayload) => Promise<string>
}

export type medium = 'email' | 'phone'

export interface Invitation {
  id: string
  sender: string
  recepient: string
  medium: medium
  expiration: number
  accessed: boolean
}

export interface InvitationRequestPayload {
  contact: string
  medium: medium
}

export interface invitationPayload {
  sender: string
  recepient: string
  medium: medium
}
