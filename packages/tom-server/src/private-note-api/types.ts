import type { NextFunction, Request, Response } from 'express'

export interface IPrivateNoteService {
  get: (author: string, target: string) => Promise<string | null>
  create: (author: string, target: string, content: string) => Promise<void>
  update: (id: number, content: string) => Promise<void>
  delete: (id: number) => Promise<void>
}

export interface IPrivateNoteApiController {
  get: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
  create: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
  update: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
  deleteNote: (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => Promise<void>
}

export interface IPrivateNoteApiValidationMiddleware {
  checkCreationRequirements: (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => void

  checkGetRequirements: (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => void

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

export interface Note {
  id: number
  authorId: string
  targetId: string
  content: string
}

export interface AuthRequest extends Request {
  userId?: string
  accessToken?: string
}
