import { type ClientEvent } from '@twake/matrix-application-server'

export interface IRoomDetail {
  room_id: string
  name: string | null
  canonical_alias: string | null
  join_rules: string | null
  history_visibility: string | null
  encryption: string | null
  avatar: string | null
  guest_access: string | null
  is_federatable: boolean | null
  topic: string | null
  room_type: string | null
}

export interface IMatrixDBRoomsRepository {
  getAllClearRoomsIds: () => Promise<string[]>
  isEncryptedRoom: (roomId: string) => Promise<boolean>
  getRoomsDetails: (roomsIds: string[]) => Promise<Record<string, IRoomDetail>>
  getRoomDetail: (roomId: string) => Promise<IRoomDetail>
  getUserDisplayName: (roomId: string, userId: string) => Promise<string | null>
  getAllClearRoomsNames: () => Promise<Array<{ room_id: string; name: string }>>
  getMembersDisplayNames: (
    roomsIds: string[]
  ) => Promise<Record<string, string | null>>
  getAllClearRoomsMessages: () => Promise<
    Array<{
      room_id: string
      event_id: string
      json: ClientEvent & { display_name: string | null }
    }>
  >
  getUserRoomsIds: (userId: string) => Promise<string[]>
  getDirectRoomsIds: (roomsIds: string[]) => Promise<string[]>
  getDirectRoomsAvatarUrl: (
    roomsIds: string[],
    userId: string
  ) => Promise<Record<string, string | null>>
}
