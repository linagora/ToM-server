import { type NextFunction, type Request, type Response } from 'express'
import PrivateNoteService from '../services'
import type { TwakeDB } from '../../db'
import type { IPrivateNoteApiController, IPrivateNoteService } from '../types'

export default class PrivateNoteApiController
  implements IPrivateNoteApiController
{
  privateNoteApiService: IPrivateNoteService

  constructor(private readonly db: TwakeDB) {
    this.privateNoteApiService = new PrivateNoteService(db)
  }

  /**
   * Creates a note
   *
   * @param {Request} req - request object
   * @param {Response} res - response object
   * @param {NextFunction} next - next function
   * @returns {Promise<void>}
   */
  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { author, target, content } = req.body

      if (
        author === undefined ||
        target === undefined ||
        content === undefined
      ) {
        throw new Error('Missing parameters', {
          cause: 'missing required fields'
        })
      }

      await this.privateNoteApiService.create(author, target, content)

      res.status(201).send()
      return
    } catch (error) {
      next(error)
    }
  }

  /**
   * Fetches a note
   *
   * @param {Request} req - request object
   * @param {Response} res - response object
   * @param {NextFunction} next - next function
   * @returns {Promise<void>}
   */
  get = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { author, target } = req.query

      if (author === undefined || target === undefined) {
        throw new Error('Missing author or target id')
      }

      const note = await this.privateNoteApiService.get(
        author as string,
        target as string
      )

      if (note === null) {
        res.status(404).send()
        return
      }

      res.status(200).json(note)
      return
    } catch (error) {
      next(error)
    }
  }

  /**
   * Deletes a note
   *
   * @param {Request} req - request object
   * @param {Response} res - response object
   * @param {NextFunction} next - next function
   * @returns {Promise<void>}
   */
  deleteNote = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params
      const itemId = +id

      await this.privateNoteApiService.delete(itemId)

      res.status(204).send()
      return
    } catch (error) {
      next(error)
    }
  }

  /**
   * Updates a note
   *
   * @param {Request} req - request object
   * @param {Response} res - response object
   * @param {NextFunction} next - next function
   * @returns {Promise<void>}
   */
  update = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, content } = req.body

      await this.privateNoteApiService.update(id, content)

      res.status(204).send()
      return
    } catch (error) {
      next(error)
    }
  }
}
