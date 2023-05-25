import type { IRoomTagsController, IRoomTagsService } from '../types'
import type { AuthRequest, IdentityServerDb } from '../../types'
import RoomTagsService from '../services'
import type { Response, NextFunction } from 'express'

class RoomTagsController implements IRoomTagsController {
  readonly roomTagsService: IRoomTagsService

  constructor(private readonly db: IdentityServerDb) {
    this.roomTagsService = new RoomTagsService(this.db)
  }

  /**
   * Fetches the tags of a room.
   *
   * @param {AuthRequest} req - The request object.
   * @param {Response} res - The response object.
   * @param {NextFunction} next - The next function.
   */
  get = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { roomId } = req.params

      const tags = await this.roomTagsService.get(req.userId as string, roomId)

      if (tags == null) {
        res.status(200).send({ tags: [] })
        return
      }

      res.status(200).json({ tags: tags.content })
      return
    } catch (error) {
      next(error)
    }
  }

  /**
   * Creates new tags for a room.
   *
   * @param {AuthRequest} req - The request object.
   * @param {Response} res - The response object.
   * @param {NextFunction} next - The next function.
   */
  create = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tags = req.body

      await this.roomTagsService.create({ ...tags, authorId: req.userId })

      res.status(201).send()
      return
    } catch (error) {
      next(error)
    }
  }

  /**
   * Updates room tags
   *
   * @param {AuthRequest} req - The request object.
   * @param {Response} res - The response object.
   * @param {NextFunction} next - The next function.
   */
  update = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { content } = req.body
      const { roomId } = req.params

      await this.roomTagsService.update(req.userId as string, roomId, content)

      res.status(204).send()
      return
    } catch (error) {
      next(error)
    }
  }

  /**
   * Removes room tags
   *
   * @param {AuthRequest} req - The request object.
   * @param {Response} res - The response object.
   * @param {NextFunction} next - The next function.
   */
  delete = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { roomId } = req.params

      await this.roomTagsService.delete(req.userId as string, roomId)

      res.status(204).send()
      return
    } catch (error) {
      next(error)
    }
  }
}

export default RoomTagsController
