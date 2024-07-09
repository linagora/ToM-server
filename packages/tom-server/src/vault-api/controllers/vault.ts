/* eslint-disable no-useless-return */
import { type TwakeDB } from '../../db'
import type { Collections } from '../../types'
import { VaultAPIError, type expressAppHandler } from '../utils'

export type VaultController = (db: TwakeDB) => expressAppHandler

export const methodNotAllowed: expressAppHandler = (req, res, next) => {
  throw new VaultAPIError('Method not allowed', 405)
}

export const saveRecoveryWords = (db: TwakeDB): expressAppHandler => {
  return (req, res, next) => {
    const { words } = req.body
    const userId = req.token.content.sub

    db.get('recoveryWords' as Collections, ['words'], { userId })
      .then((data) => {
        if (data.length > 0) {
          db.update('recoveryWords' as Collections, { words }, 'userId', userId)
            .then((_) => {
              res
                .status(200)
                .json({ message: 'Updated recovery words sucessfully' })
            })
            .catch((err) => {
              next(err)
              return
            })
        } else {
          db.insert('recoveryWords' as Collections, { userId, words })
            .then((_) => {
              res
                .status(201)
                .json({ message: 'Saved recovery words sucessfully' })
            })
            .catch((err) => {
              next(err)
              return
            })
        }
      })
      .catch((err) => {
        next(err)
      })
  }
}

export const getRecoveryWords = (db: TwakeDB): expressAppHandler => {
  return (req, res, next) => {
    const userId: string = req.token.content.sub
    // @ts-expect-error recoveryWords isn't declared in Collections
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

    // @ts-expect-error recoveryWords isn't declared in Collections
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
