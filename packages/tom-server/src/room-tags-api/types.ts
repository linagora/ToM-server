import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../types'

export interface IRoomTagsController {
  get: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
  create: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
  update: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
  delete: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
}

export interface IRoomTagsService {
  get: (authorId: string, roomId: string) => Promise<RoomTag | null>
  create: (tag: RoomTag) => Promise<void>
  update: (authorId: string, roomId: string, content: string[]) => Promise<void>
  delete: (authorId: string, roomId: string) => Promise<void>
}

export interface RoomTag {
  id?: string
  content: string[]
  roomId: string
  authorId: string
}

export interface IRoomTagsMiddleware {
  checkFetchRequirements: (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => Promise<void>
  checkCreateRequirements: (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => Promise<void>
  checkUpdateRequirements: (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => Promise<void>
  checkDeleteRequirements: (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => Promise<void>
}

export interface RoomMembership {
  id: string
  user_id: string
  room_id: string
}
