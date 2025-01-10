export interface IInvitationService {
  invite: (payload: InvitationPayload, authToken: string) => Promise<void>
  accept: (token: string, authToken: string) => Promise<void>
  list: (userId: string) => Promise<Invitation[]>
  generateLink: (payload: InvitationPayload) => Promise<string>
}

export type medium = 'email' | 'phone'

export interface Invitation {
  id: string
  sender: string
  recepient: string
  medium: medium
  expiration: number
  accessed: boolean
  room_id?: string
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

export interface InsertInvitationPayload extends InvitationPayload {
  room_id?: string
}

export interface RoomCreationPayload {
  is_direct: boolean
  preset: 'private_chat' | 'public_chat' | 'trusted_private_chat'
}

export interface RoomCreationResponse {
  room_id: string
}
