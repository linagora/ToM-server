import { MatrixErrors } from '@twake/matrix-identity-server'
import { type Request } from 'express'
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

