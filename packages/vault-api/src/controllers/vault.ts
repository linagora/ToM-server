import type VaultDb from '../db'
import { VaultAPIError, type expressAppHandler } from '../utils'

export const methodNotAllowed: expressAppHandler = (req, res, next) => {
  res.status(405).json({ error: 'Method not allowed' })
}

export const saveRecoveryWords = (db: VaultDb): expressAppHandler => {
  return (req, res, next) => {
    const data: Record<string, string> = {
      userId: req.token.content.sub,
      words: req.body.words
    }
    db.insert(data)
      .then((_) => {
        res.status(201).json({ message: 'Saved recovery words sucessfully' })
      })
      .catch((err) => {
        res.status(500).json({
          error: err.message
        })
      })
  }
}

export const getRecoveryWords = (db: VaultDb): expressAppHandler => {
  return (req, res, next) => {
    const userId: string = req.token.content.sub
    db.get(userId)
      .then((data: Array<Record<string, string | string>>) => {
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
        const statusCode: number = err.statusCode ?? 500
        res.status(statusCode)
        res.json({
          error: err.message
        })
      })
  }
}
