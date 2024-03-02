import { type ClientEvent } from '@twake/matrix-application-server'
import { type MatrixDB } from '@twake/matrix-identity-server'
import lodash from 'lodash'
import { type IMatrixDBRoomsRepository } from './interfaces/matrix-db-rooms-repository.interface'
const { groupBy, mapValues } = lodash

export class MatrixDBRoomsRepository implements IMatrixDBRoomsRepository {
  constructor(private readonly _matrixDb: MatrixDB) {}

  async getAllClearRoomsIds(): Promise<string[]> {
    return (
      (await this._matrixDb.getAll('room_stats_state', [
        'room_id',
        'encryption'
      ])) as Array<{ room_id: string; encryption: string | null }>
    )
      .filter((room) => room.encryption == null)
      .map((room) => room.room_id)
  }

  async getAllClearRoomsNames(): Promise<
    Array<{ room_id: string; name: string }>
  > {
    return (
      (await this._matrixDb.getAll('room_stats_state', [
        'room_id',
        'encryption',
        'name'
      ])) as Array<{
        room_id: string
        encryption: string | null
        name: string | null
      }>
    )
      .filter((room) => room.encryption == null && room.name != null)
      .map((room) => ({ room_id: room.room_id, name: room.name as string }))
  }

  async getMembersDisplayNames(
    roomsIds: string[]
  ): Promise<Record<string, string | null>> {
    const results = (await this._matrixDb.get(
      'room_memberships',
      ['user_id', 'display_name'],
      {
        room_id: roomsIds
      }
    )) as Array<{ user_id: string; display_name: string | null }>

    return mapValues(
      groupBy(results, 'user_id'),
      (res) => res.map((r) => r.display_name).pop() as string | null
    )
  }

  async getAllClearRoomsMessages(): Promise<
    Array<{
      room_id: string
      event_id: string
      json: ClientEvent & { display_name: string | null }
    }>
  > {
    const clearRoomsIds = await this.getAllClearRoomsIds()
    const displayNameByUserId = await this.getMembersDisplayNames(clearRoomsIds)
    return (
      (await this._matrixDb.get('event_json', [
        'room_id',
        'event_id',
        'json'
      ])) as Array<{ room_id: string; event_id: string; json: string }>
    )
      .map((event) => ({
        event_id: event.event_id,
        room_id: event.room_id,
        json: JSON.parse(event.json) as ClientEvent
      }))
      .filter(
        (event) =>
          clearRoomsIds.includes(event.room_id) &&
          event.json.type === 'm.room.message'
      )
      .map((event) => ({
        ...event,
        json: {
          ...event.json,
          display_name: displayNameByUserId[event.json.sender] ?? null
        }
      }))
  }
}
