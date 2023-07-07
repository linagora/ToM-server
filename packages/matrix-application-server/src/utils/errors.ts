import { type Request } from 'express'
import { validationResult, type ValidationError } from 'express-validator'
import { type expressAppHandlerError } from './utils'

export const errCodes = {
  // The homeserver has not supplied credentials
  unauthorized: 'M_UNAUTHORIZED',

  // The token hs_token does not match it own hs_token
  forbidden: 'M_FORBIDDEN',

  // The request point to an unsupported (or unknown) endpoint it is returned with a 404 HTTP status code
  // This is also used denote an unsupported method to a known endpoint, it is returned with a 405 HTTP status code
  unrecognized: 'M_UNRECOGNIZED',

  // The request trying to reach out an old endpoint
  unknown: 'M_UNKNOWN'
} as const

export const defaultErrorMsg = 'Internal server error'

interface ErrorResponseBody<T = typeof errCodes> {
  error: string
  errcode?: T[keyof T]
}

const matrixErrortMsg = (s: string): string => {
  const lowerCaseMsg = s.replace(/^M_/, '').toLowerCase()
  return lowerCaseMsg.charAt(0).toUpperCase() + lowerCaseMsg.slice(1)
}

export class AppServerAPIError<T = typeof errCodes> extends Error {
  statusCode: number
  errcode?: T[keyof T]

  constructor(
    error: {
      status?: number
      message?: string
      code?: T[keyof T]
    } = {}
  ) {
    let errorMessage = defaultErrorMsg
    if (error.message != null) {
      errorMessage = error.message
    } else if (error.code != null) {
      errorMessage = matrixErrortMsg(error.code as string)
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
  const appServerError: AppServerAPIError =
    error instanceof AppServerAPIError
      ? error
      : new AppServerAPIError({ message: error.message })
  res.status(appServerError.statusCode)
  let bodyResponse: ErrorResponseBody = {
    error: appServerError.message
  }
  if (appServerError.errcode != null) {
    bodyResponse = { ...bodyResponse, errcode: appServerError.errcode }
  }
  res.statusMessage = appServerError.message
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
    throw new AppServerAPIError({
      status: 400,
      message: errorMessage
    })
  }
}
