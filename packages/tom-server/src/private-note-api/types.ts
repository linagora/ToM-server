import type { Request } from 'express'

export interface IPrivateNoteService {
  get: (author: string, target: string) => Promise<string | null>
  create: (author: string, target: string, content: string) => Promise<Note>
  update: (id: number, content: string) => Promise<Note>
  delete: (id: number) => Promise<Note>
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
