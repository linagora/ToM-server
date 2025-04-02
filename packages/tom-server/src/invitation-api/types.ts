export interface IInvitationService {
  invite: (payload: InvitationPayload) => Promise<string>
  accept: (token: string, authorization: string) => Promise<void>
  list: (userId: string) => Promise<Invitation[]>
  generateLink: (payload: InvitationPayload) => Promise<string>
  getInvitationStatus: (token: string) => Promise<Invitation>
}

export type medium = 'email' | 'phone'

export interface Invitation {
  id: string
  sender: string
  recipient: string
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
  recipient: string
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
