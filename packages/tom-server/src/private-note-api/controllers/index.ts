import { type NextFunction, type Request, type Response } from 'express'
import PrivateNoteService from '../services'

/**
 * Creates a note
 *
 * @param {Request} req - request object
 * @param {Response} res - response object
 * @param {NextFunction} next - next function
 * @returns {Promise<void>}
 */
export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { author, target, content } = req.body

    await PrivateNoteService.create(author, target, content)

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
export const get = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { author, target } = req.query

    if (author === undefined || target === undefined) {
      throw new Error('Missing author or target id')
    }

    const note = await PrivateNoteService.get(
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
export const deleteNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params
    const itemId = +id

    if (id === undefined || isNaN(itemId)) {
      throw new Error('Missing id')
    }

    await PrivateNoteService.delete(itemId)

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
export const update = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, content } = req.body

    await PrivateNoteService.update(id, content)

    res.status(204).send()
    return
  } catch (error) {
    next(error)
  }
}
