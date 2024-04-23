import ldapjs from 'ldapjs'
import { type TwakeDB } from '../../db'
import { type Collections } from '../../types'
import { type ITwakeRoomModel } from '../types'
const { EqualityFilter, OrFilter, SubstringFilter } = ldapjs

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
        ...Object.keys(this.filter)
          .map((key: string) => {
            if (Array.isArray(this.filter[key])) {
              return (this.filter[key] as string[]).map((value) =>
                TwakeRoom._getLdapFilter(key, value)
              )
            } else {
              return TwakeRoom._getLdapFilter(key, this.filter[key].toString())
            }
          })
          .flat()
      ]
    })
    return ldapFilter.matches(user)
  }

  private static _getLdapFilter(
    attribute: string,
    value: string
  ): ldapjs.Filter {
    if (value.includes('*')) {
      const filterValues = value.split('*')
      return new SubstringFilter({
        attribute,
        initial: filterValues[0] ?? '',
        any: filterValues.slice(1, -1) ?? [],
        final: filterValues.pop() ?? ''
      })
    }
    return new EqualityFilter({
      attribute,
      value
    })
  }
}
