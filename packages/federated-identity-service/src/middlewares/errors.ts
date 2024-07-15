import { MatrixErrors } from '@twake/matrix-identity-server'
import { type Request } from 'express'
import { validationResult, type ValidationError } from 'express-validator'
import {
  type ErrorResponseBody,
  type expressAppHandlerError,
  type federatedIdentityServiceErrorCode
} from '../types'

export const defaultErrorMsg = 'Internal server error'

export class FederatedIdentityServiceError extends Error {
  statusCode: number
  errcode?: federatedIdentityServiceErrorCode

  constructor(
    error: {
      status?: number
      message?: string
      code?: federatedIdentityServiceErrorCode
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
  const federatedIdentityServiceError: FederatedIdentityServiceError =
    error instanceof FederatedIdentityServiceError
      ? error
      : new FederatedIdentityServiceError({ message: error.message })
  res.status(federatedIdentityServiceError.statusCode)
  let bodyResponse: ErrorResponseBody = {
    error: federatedIdentityServiceError.message
  }
  if (federatedIdentityServiceError.errcode != null) {
    bodyResponse = {
      errcode: federatedIdentityServiceError.errcode,
      ...bodyResponse
    }
  }
  res.statusMessage = federatedIdentityServiceError.message
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
    throw new FederatedIdentityServiceError({
      status: 400,
      message: errorMessage,
      code: MatrixErrors.errCodes.invalidParam
    })
  }
}
