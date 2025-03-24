export interface IInvitationService {
  invite: (payload: InvitationPayload) => Promise<void>
  accept: (token: string, authorization: string) => Promise<void>
  list: (userId: string) => Promise<Invitation[]>
  generateLink: (payload: InvitationPayload) => Promise<string>
}

export type medium = 'email' | 'phone'

export interface Invitation {
  id: string
  sender: string
  recepient: string
  medium: medium
  expiration: string
  accessed: boolean
}

export interface InvitationRequestPayload {
  contact: string
  medium: medium
}

export interface InvitationPayload {
  sender: string
  recepient: string
  medium: medium
}

export interface RoomCreationPayload {
  is_direct: boolean
  preset: 'private_chat' | 'public_chat' | 'trusted_private_chat'
  invite?: string[]
}

export interface RoomCreationResponse {
  room_id: string
}
