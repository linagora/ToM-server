import { EqualityFilter, OrFilter } from 'ldapjs'
import { type TwakeDB } from '../../db'
import { type Collections } from '../../types'
import { type ITwakeRoomModel } from '../types'

export class TwakeRoom implements ITwakeRoomModel {
  constructor(
    readonly id: string,
    readonly filter: Record<string, string | number | string[]>
  ) {}

  public async saveRoom(db: TwakeDB): Promise<void> {
    await db.insert('rooms' as Collections, {
      id: this.id,
      filter: JSON.stringify(this.filter)
    })
  }

  static async getRoom(
    db: TwakeDB,
    id: string
  ): Promise<TwakeRoom | undefined> {
    const roomsfromDb = (await db.get('rooms' as Collections, [], {
      id
    })) as Array<{
      id: string
      filter: string
    }>
    if (roomsfromDb != null && roomsfromDb.length > 0) {
      const room = new TwakeRoom(
        roomsfromDb[0].id,
        JSON.parse(roomsfromDb[0].filter)
      )
      return room
    }
    return undefined
  }

  static async getAllRooms(db: TwakeDB): Promise<TwakeRoom[]> {
    const roomsfromDb = (await db.getAll('rooms' as Collections, [])) as Array<{
      id: string
      filter: string
    }>
    if (roomsfromDb != null && roomsfromDb.length > 0) {
      return roomsfromDb.map(
        (room) => new TwakeRoom(room.id, JSON.parse(room.filter))
      )
    }
    return []
  }

  public async updateRoom(
    db: TwakeDB,
    filter: Record<string, string | number | string[]>
  ): Promise<void> {
    await db.update(
      'rooms' as Collections,
      { filter: JSON.stringify(filter) },
      'id',
      this.id
    )
  }

  public userDataMatchRoomFilter(user: any): boolean {
    const ldapFilter = new OrFilter({
      filters: [
        new EqualityFilter({
          attribute: 'objectClass',
          value: '*'
        }),
        ...Object.keys(this.filter).map(
          (key: string) =>
            new EqualityFilter({
              attribute: key,
              value: this.filter[key].toString()
            })
        )
      ]
    })
    return ldapFilter.matches(user)
  }
}
