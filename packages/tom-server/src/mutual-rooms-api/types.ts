import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../types'

export interface Room {
  room_id: string
  user_id: string
}

export interface RoomInformation {
  name: string
  room_id: string
  topic: string
  room_type: string
}

export interface IMutualRoomsApiController {
  get: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
}

export interface IMutualRoomsService {
  fetchMutualRooms: (
    userId: string,
    targetUserId: string
  ) => Promise<RoomInformation[]>
}
