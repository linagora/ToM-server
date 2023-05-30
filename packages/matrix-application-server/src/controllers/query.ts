import { AppServerAPIError, type expressAppHandler } from '../utils'
import { validationResult, type ValidationError } from 'express-validator'

export const query: expressAppHandler = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const errorMessage = errors
      .array({ onlyFirstError: true })
      .map(
        (error: ValidationError) => `Error ${error.type}: ${String(error.msg)}`
      )
      .join(', ')
    throw new AppServerAPIError({
      status: 400,
      message: errorMessage
    })
  }
  res.send()
}
