import { type TwakeDB } from '../../db'
import { VaultAPIError, type expressAppHandler } from '../utils'

export type VaultController = (db: TwakeDB) => expressAppHandler

export const methodNotAllowed: expressAppHandler = (req, res, next) => {
  throw new VaultAPIError('Method not allowed', 405)
}

export const saveRecoveryWords = (db: TwakeDB): expressAppHandler => {
  return (req, res, next) => {
    const data: Record<string, string> = {
      userId: req.token.content.sub,
      words: req.body.words
    }
    // @ts-expect-error 'recoveryWords' isn't declared in Collection
    db.insert('recoveryWords', data)
      .then((_) => {
        res.status(201).json({ message: 'Saved recovery words sucessfully' })
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
