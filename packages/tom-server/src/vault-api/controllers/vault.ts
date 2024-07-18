/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable no-useless-return */
import { type TwakeDB, type twakeDbCollections } from '../../types'
import { VaultAPIError, type expressAppHandler } from '../utils'

export type VaultController = (db: TwakeDB) => expressAppHandler

export const methodNotAllowed: expressAppHandler = (req, res, next) => {
  throw new VaultAPIError('Method not allowed', 405)
}

/**
 * Save use recovery words
 *
 * @param {TwakeDB} db - the database instance
 * @retuns {expressAppHandler} - the express handler
 */
export const saveRecoveryWords = (db: TwakeDB): expressAppHandler => {
  return async (req, res, next) => {
    const { words } = req.body
    const userId = req.token.content.sub

    try {
      if (words === undefined || words.length === 0) {
        res.status(400).json({ error: 'Missing recovery words' })
        return
      }

      const data = await db.get(
        'recoveryWords' as twakeDbCollections,
        ['words'],
        {
          userId
        }
      )

      if (data.length > 0) {
        res.status(409).json({ error: 'User already has recovery words' })
        return
      } else {
        await db.insert('recoveryWords' as twakeDbCollections, {
          userId,
          words
        })
        res.status(201).json({ message: 'Saved recovery words successfully' })
        return
      }
    } catch (err) {
      next(err)
    }
  }
}

export const getRecoveryWords = (db: TwakeDB): expressAppHandler => {
  return (req, res, next) => {
    const userId: string = req.token.content.sub
    db.get('recoveryWords', ['words'], { userId })
      .then((data) => {
        if (data.length === 0) {
          const error = new VaultAPIError('User has no recovery sentence', 404)
          throw error
        } else if (data.length > 1) {
          const error = new VaultAPIError(
            'User has more than one recovery sentence',
            409
          )
          throw error
        }
        res.status(200).json({ words: data[0].words })
      })
      .catch((err) => {
        next(err)
      })
  }
}

// Delete recovery words from database
export const deleteRecoveryWords = (db: TwakeDB): expressAppHandler => {
  return (req, res, next) => {
    const userId: string = req.token.content.sub

    db.get('recoveryWords', ['words'], { userId })
      .then((data) => {
        if (data.length === 0) {
          const error = new VaultAPIError('User has no recovery sentence', 404)
          throw error
        }

        db.deleteWhere('recoveryWords', {
          field: 'userId',
          operator: '=',
          value: userId
        })
          .then((_) => {
            // 204 requires no content to be sent
            res.status(204).json()
          })
          .catch((err) => {
            next(err)
          })
      })
      .catch((err) => {
        next(err)
      })
  }
}

/**
 * Update recovery words in database
 *
 * @param {TwakeDB} db - the database instance
 * @returns {expressAppHandler} - the express controller handler
 */
export const updateRecoveryWords = (db: TwakeDB): expressAppHandler => {
  return async (req, res, next) => {
    const userId: string = req.token.content.sub
    const { words } = req.body

    try {
      if (words === undefined || words.length === 0) {
        res.status(400).json({ message: 'Missing recovery sentence' })
        return
      }

      const data = await db.get(
        'recoveryWords' as twakeDbCollections,
        ['words'],
        {
          userId
        }
      )

      if (data.length === 0) {
        res.status(404).json({ message: 'User has no recovery sentence' })
        return
      }

      await db.update(
        'recoveryWords' as twakeDbCollections,
        { words },
        'userId',
        userId
      )

      res.status(200).json({ message: 'Updated recovery words successfully' })
      return
    } catch (err) {
      next(err)
    }
  }
}
