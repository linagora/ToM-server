import { MatrixErrors } from '@twake/matrix-identity-server'
import { type Request } from 'express'
import { validationResult, type ValidationError } from 'express-validator'
import {
  type ErrorResponseBody,
  type expressAppHandlerError,
  type federationServerErrorCode
} from '../types'

export const defaultErrorMsg = 'Internal server error'

export class FederationServerError extends Error {
  statusCode: number
  errcode?: federationServerErrorCode

  constructor(
    error: {
      status?: number
      message?: string
      code?: federationServerErrorCode
    } = {}
  ) {
    let errorMessage = defaultErrorMsg
    if (error.message != null) {
      errorMessage = error.message
    } else if (error.code != null) {
      errorMessage = MatrixErrors.defaultMsg(error.code)
    }
    super(errorMessage)
    if (error.code != null) {
      this.errcode = error.code
    }
    this.statusCode = error.status ?? 500
  }
}

export const errorMiddleware: expressAppHandlerError = (
  error,
  req,
  res,
  next
) => {
  const federationServerError: FederationServerError =
    error instanceof FederationServerError
      ? error
      : new FederationServerError({ message: error.message })
  res.status(federationServerError.statusCode)
  let bodyResponse: ErrorResponseBody = {
    error: federationServerError.message
  }
  if (federationServerError.errcode != null) {
    bodyResponse = { errcode: federationServerError.errcode, ...bodyResponse }
  }
  res.statusMessage = federationServerError.message
  res.json(bodyResponse)
}

export const validationErrorHandler = (req: Request): void => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const errorMessage = errors
      .array({ onlyFirstError: true })
      .map(
        (error: ValidationError) =>
          `Error ${error.type}: ${String(error.msg)}${
            'path' in error ? ` (property: ${error.path})` : ''
          }`
      )
      .join(', ')
    throw new FederationServerError({
      status: 400,
      message: errorMessage
    })
  }
}
