import { type ClientEvent } from '@twake/matrix-application-server'

export interface IMatrixDBRoomsRepository {
  getAllClearRoomsIds: () => Promise<string[]>
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
}
