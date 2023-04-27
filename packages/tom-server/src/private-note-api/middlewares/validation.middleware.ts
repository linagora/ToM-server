import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../types'
import prisma from '../../prisma/client'

/**
 * Checks if the creation request is valid.
 *
 * @param {AuthRequest} req -  the request object
 * @param {Response} res - the response object
 * @param {NextFunction} next - the next handler
 */
export const checkCreationRequirements = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { author, target, content } = req.body

    if (author === undefined || target === undefined || content === undefined) {
      throw new Error('Missing required fields')
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
export const checkGetRequirements = (
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
export const checkUpdateRequirements = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, content } = req.body

    if (id === undefined || content === undefined) {
      throw new Error('Missing required query parameters')
    }

    const ExistingNode = await prisma.note.findFirst({
      where: {
        id,
        authorId: req.userId
      }
    })

    if (ExistingNode === null) {
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
export const checkDeleteRequirements = async (
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
    const ExistingNode = await prisma.note.findFirst({
      where: {
        id: itemId,
        authorId: req.userId
      }
    })

    if (ExistingNode === null) {
      throw new Error('Unauthorized')
    }

    next()
  } catch (error) {
    res.status(400).json({ message: 'Bad Request' })
  }
}
