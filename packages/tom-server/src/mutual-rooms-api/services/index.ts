import type { MatrixDBBackend } from '@twake/matrix-identity-server'
import type { IMutualRoomsService, RoomInformation, Room } from '../types'

export default class MutualRoomsService implements IMutualRoomsService {
  constructor(private readonly db: MatrixDBBackend) {}

  /**
   * Fetches the list of mutual rooms for the given users
   *
   * @param {string} userId
   * @param {string} targetUserId
   * @returns {Promise<RoomInformation[]>}
   */
  fetchMutualRooms = async (
    userId: string,
    targetUserId: string
  ): Promise<RoomInformation[]> => {
    try {
      const userRooms = (await this.db.get(
        'room_memberships',
        ['room_id', 'user_id'],
        'user_id',
        userId
      )) as unknown as Room[]

      const targetUserRooms = (await this.db.get(
        'room_memberships',
        ['room_id', 'user_id'],
        'user_id',
        targetUserId
      )) as unknown as Room[]

      const mutualRooms = userRooms.filter((room) =>
        targetUserRooms.some(
          (targetRoom) => targetRoom.room_id === room.room_id
        )
      )

      const roomsInfo = await Promise.all(
        mutualRooms.map(async (room) => {
          const information = (await this.db.get(
            'room_stats_state',
            ['room_id', 'name', 'topic', 'room_type'],
            'room_id',
            room.room_id
          )) as unknown as RoomInformation[]

          return information?.[0]
        })
      )

      return roomsInfo.filter((room) => room !== undefined)
    } catch (error) {
      throw Error('Failed to fetch mutual rooms')
    }
  }
}
