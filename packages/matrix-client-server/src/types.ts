import { type Config as MIdentityServerConfig } from '@twake/matrix-identity-server'

export type Config = MIdentityServerConfig

export type DbGetResult = Array<
  Record<string, string | number | Array<string | number>>
>

export interface ClientEvent {
  content: { [key: string]: any }
  event_id: string
  origin_server_ts: number
  room_id: string
  sender: string
  state_key?: string
  type: string
  unsigned?: UnsignedData
}
export interface EventContent {
  avatar_url?: string
  displayname?: string | null
  is_direct?: boolean
  join_authorised_via_users_server?: boolean
  membership: string
  reason?: string
  third_party_invite?: { [key: string]: any }
}

export interface EventFilter {
  limit?: number
  not_senders?: string[]
  not_types?: string[]
  senders?: string[]
  types?: string[]
}
export interface Invite {
  display_name: string
  signed: signed
}
export interface LocalMediaRepository {
  media_id: string
  media_length: string
  user_id: string
}
export interface MatrixUser {
  name: string
}
export interface RoomEventFilter extends EventFilter {
  contains_url?: boolean
  include_redundant_members?: boolean
  lazy_load_members?: boolean
  unread_thread_notifications?: boolean
}
export interface RoomFilter {
  account_data?: RoomEventFilter
  ephemeral?: RoomEventFilter
  include_leave?: boolean
  not_rooms?: string[]
  rooms?: string[]
  state?: RoomEventFilter
  timeline?: RoomEventFilter
}
export interface RoomMember {
  avatar_url: string
  display_name: string
}
export interface signed {
  mxid: string
  signatures: Record<string, Record<string, string>>
  token: string
}
export interface UnsignedData {
  age?: number
  membership?: string
  prev_content?: { [key: string]: any }
  redacted_because?: ClientEvent
  transaction_id?: string
}
export interface UserQuota {
  user_id: string
  size: number
}
