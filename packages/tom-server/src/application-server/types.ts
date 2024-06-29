import { type TwakeDB } from '../types'

export interface ITwakeRoomModel {
  readonly id: string
  readonly filter: Record<string, string | number | string[]>
  saveRoom: (db: TwakeDB) => Promise<void>
  updateRoom: (
    db: TwakeDB,
    filter: Record<string, string | number | string[]>
  ) => Promise<void>
  userDataMatchRoomFilter: (user: any) => boolean
}
