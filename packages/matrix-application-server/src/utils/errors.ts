import { type expressAppHandlerError } from './utils'

export enum ErrCodes {
  // The token hs_token does not match it own hs_token
  M_FORBIDDEN = 'M_FORBIDDEN',

  // The request point to an unsupported (or unknown) endpoint it is returned with a 404 HTTP status code
  // This is also used denote an unsupported method to a known endpoint, it is returned with a 405 HTTP status code
  M_UNRECOGNIZED = 'M_UNRECOGNIZED',

  // The request trying to reach out an old endpoint
  M_UNKNOWN = 'M_UNKNOWN'
}

export const defaultErrorMsg = 'Internal server error'

interface ErrorResponseBody {
  error: string
  errcode?: keyof typeof ErrCodes
}

const matrixErrortMsg = (s: string): string => {
  const lowerCaseMsg = s.replace(/^M_/, '').toLowerCase()
  return lowerCaseMsg.charAt(0).toUpperCase() + lowerCaseMsg.slice(1)
}

export class AppServerAPIError extends Error {
  statusCode: number
  errcode?: keyof typeof ErrCodes

  constructor(
    error: {
      status?: number
      message?: string
      code?: keyof typeof ErrCodes
    } = {}
  ) {
    let errorMessage = defaultErrorMsg
    if (error.message != null) {
      errorMessage = error.message
    } else if (error.code != null) {
      errorMessage = matrixErrortMsg(error.code)
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
  res.json(bodyResponse)
}
