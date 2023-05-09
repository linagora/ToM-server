import type { NextFunction, Response } from 'express'
import type { IPrivateNoteApiValidationMiddleware, Note } from '../types'
import type { TwakeDB } from '../../db'
import type { Collections, AuthRequest } from '../../types'

export default class PrivateNoteApiValidationMiddleware
  implements IPrivateNoteApiValidationMiddleware
{
  constructor(private readonly db: TwakeDB) {}

  /**
   * Checks if the creation request is valid.
   *
   * @param {AuthRequest} req -  the request object
   * @param {Response} res - the response object
   * @param {NextFunction} next - the next handler
   */
  checkCreationRequirements = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const { author, target, content } = req.body

      if (
        author === undefined ||
        target === undefined ||
        content === undefined
      ) {
        throw new Error('Missing required fields')
      }

      /* istanbul ignore if */
      if (author !== req.userId) {
        throw new Error('Unauthorized')
      }

      next()
    } catch (error) {
      res.status(400).json({ message: 'Bad Request' })
    }
  }

  /**
   * Checks if the creation request is valid.
   *
   * @param {AuthRequest} req -  the request object
   * @param {Response} res - the response object
   * @param {NextFunction} next - the next handler
   */
  checkGetRequirements = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const { author, target } = req.query

      if (author === undefined || target === undefined) {
        throw new Error('Missing required query parameters')
      }

      if (author !== req.userId) {
        throw new Error('Unauthorized')
      }

      next()
    } catch (error) {
      res.status(400).json({ message: 'Bad Request' })
    }
  }

  /**
   * Checks if the creation request is valid.
   *
   * @param {AuthRequest} req -  the request object
   * @param {Response} res - the response object
   * @param {NextFunction} next - the next handler
   */
  checkUpdateRequirements = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, content } = req.body

      if (id === undefined || content === undefined) {
        throw new Error('Missing required query parameters')
      }

      const ExistingNotes = (await this.db.get(
        'PrivateNotes' as Collections,
        ['authorId'],
        'id',
        id
      )) as unknown as Note[]

      /* istanbul ignore if */
      if (ExistingNotes.length === 0) {
        throw new Error('Not found')
      }

      if (
        ExistingNotes?.find((note) => note.authorId === req.userId) ===
        undefined
      ) {
        throw new Error('Unauthorized')
      }

      next()
    } catch (error) {
      res.status(400).json({ message: 'Bad Request' })
    }
  }

  /**
   * Checks if the creation request is valid.
   *
   * @param {AuthRequest} req -  the request object
   * @param {Response} res - the response object
   * @param {NextFunction} next - the next handler
   */
  checkDeleteRequirements = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params

      if (id === undefined) {
        throw new Error('Missing required query parameters')
      }

      const itemId = +id

      if (isNaN(itemId)) {
        throw new Error('Bad Request')
      }

      const existingNotes = (await this.db.get(
        'PrivateNotes' as Collections,
        ['authorId'],
        'id',
        itemId
      )) as unknown as Note[]

      /* istanbul ignore if */
      if (existingNotes.length === 0) {
        throw new Error('Not Found')
      }

      /* istanbul ignore if */
      if (
        existingNotes?.find((note) => note.authorId === req.userId) ===
        undefined
      ) {
        throw new Error('Unauthorized')
      }

      next()
    } catch (error) {
      res.status(400).json({ message: 'Bad Request' })
    }
  }
}
