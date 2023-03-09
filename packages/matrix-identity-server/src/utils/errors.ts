export const errCodes = {

  // Not authorizated (not authenticated)
  forbidden: 'M_FORBIDDEN',

  // Not authorized
  unAuthorized: 'M_UNAUTHORIZED',

  // The resource requested could not be located.
  notFound: 'M_NOT_FOUND',

  // The request was missing one or more parameters.
  missingParams: 'M_MISSING_PARAMS',

  // The request contained one or more invalid parameters.
  invalidParam: 'M_INVALID_PARAM',

  // The session has not been validated.
  sessionNotValidated: 'M_SESSION_NOT_VALIDATED',

  // A session could not be located for the given parameters.
  noValidSession: 'M_NO_VALID_SESSION',

  // The session has expired and must be renewed.
  sessionExpired: 'M_SESSION_EXPIRED',

  // The email address provided was not valid.
  invalidEmail: 'M_INVALID_EMAIL',

  // There was an error sending an email. Typically seen when attempting to verify ownership of a given email address.
  emailSendError: 'M_EMAIL_SEND_ERROR',

  // The provided third party address was not valid.
  invalidAddress: 'M_INVALID_ADDRESS',

  // There was an error sending a notification. Typically seen when attempting to verify ownership of a given third party address.
  sendError: 'M_SEND_ERROR',

  // The request contained an unrecognised value, such as an unknown token or medium.
  // This is also used as the response if a server did not understand the request. This is expected to be returned with a 404 HTTP status code if the endpoint is not implemented or a 405 HTTP status code if the endpoint is implemented, but the incorrect HTTP method is used.
  unrecognized: 'M_UNRECOGNIZED',

  // The third party identifier is already in use by another user. Typically this error will have an additional mxid property to indicate who owns the third party identifier.
  threepidInUse: 'M_THREEPID_IN_USE',
 
  // An unknown error has occurred.
  unknown: 'M_UNKNOWN',

  // Server requires some policies
  termsNotSigned: 'M_TERMS_NOT_SIGNED'
}

const defaultMsg = (s: string): string => {
  return s.replace(/^M_/, '')
    .split('_')
    .map(s => {
      const t = s.toLowerCase()
      return t.charAt(0).toUpperCase() + t.slice(1)
    })
    .join(' ')
}

export const errMsg = (code: keyof typeof errCodes, explanation?: string): object => {
  const errCode = errCodes[code]
  return {
    errcode: errCode,
    error: (explanation != null) ? explanation : defaultMsg(errCode)
  }
}
