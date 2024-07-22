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

  // The request contained unsupported additional parameters.
  unknownParam: 'UNKNOWN_PARAM',

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

  // Server requires some policies
  termsNotSigned: 'M_TERMS_NOT_SIGNED',

  // The third party identifier is already in use by another user. Typically this error will have an additional mxid property to indicate who owns the third party identifier.
  threepidInUse: 'M_THREEPID_IN_USE',

  // An unknown error has occurred.
  unknown: 'M_UNKNOWN',

  // The request contained an unrecognised value, such as an unknown token or medium.
  // This is also used as the response if a server did not understand the request. This is expected to be returned with a 404 HTTP status code if the endpoint is not implemented or a 405 HTTP status code if the endpoint is implemented, but the incorrect HTTP method is used.
  unrecognized: 'M_UNRECOGNIZED',

  // An additional response parameter, soft_logout, might be present on the response for 401 HTTP status codes
  unknownToken: 'M_UNKNOWN_TOKEN',

  // No access token was specified for the request
  missingToken: 'M_MISSING_TOKEN',

  // Request contained valid JSON, but it was malformed in some way, e.g. missing required keys, invalid values for keys
  badJson: 'M_BAD_JSON',

  // Request did not contain valid JSON
  notJson: 'M_NOT_JSON',

  // Too many requests have been sent in a short period of time. Wait a while then try again.
  limitExceeded: 'M_LIMIT_EXCEEDED',

  // The user ID associated with the request has been deactivated. Typically for endpoints that prove authentication, such as /login.
  userDeactivated: 'M_USER_DEACTIVATED',

  // Encountered when trying to register a user ID which has been taken.
  userInUse: 'M_USER_IN_USE',

  // Encountered when trying to register a user ID which is not valid.
  invalidUsername: 'M_INVALID_USERNAME',

  // Sent when the room alias given to the createRoom API is already in use.
  roomInUse: 'M_ROOM_IN_USE',

  // Sent when the initial state given to the createRoom API is invalid.
  invalidRoomState: 'M_INVALID_ROOM_STATE',

  // Sent when a threepid given to an API cannot be used because no record matching the threepid was found.
  threepidNotFound: 'M_THREEPID_NOT_FOUND',

  // Authentication could not be performed on the third-party identifier.
  threepidAuthFailed: 'M_THREEPID_AUTH_FAILED',

  // The server does not permit this third-party identifier. This may happen if the server only permits, for example, email addresses from a particular domain.
  threepidDenied: 'M_THREEPID_DENIED',

  // The client’s request used a third-party server, e.g. identity server, that this server does not trust.
  serverNotTrusted: 'M_SERVER_NOT_TRUSTED',

  // The client’s request to create a room used a room version that the server does not support.
  unsupportedRoomVersion: 'M_UNSUPPORTED_ROOM_VERSION',

  // The client attempted to join a room that has a version the server does not support. Inspect the room_version property of the error response for the room’s version.
  incompatibleRoomVersion: 'M_INCOMPATIBLE_ROOM_VERSION',

  // The state change requested cannot be performed, such as attempting to unban a user who is not banned.
  badState: 'M_BAD_STATE',

  // The room or resource does not permit guests to access it.
  guestAccessForbidden: 'M_GUEST_ACCESS_FORBIDDEN',

  // A Captcha is required to complete the request.
  captchaNeeded: 'M_CAPTCHA_NEEDED',

  // The Captcha provided did not match what was expected.
  captchaInvalid: 'M_CAPTCHA_INVALID',

  // A required parameter was missing from the request.
  missingParam: 'M_MISSING_PARAM',

  // The request or entity was too large.
  tooLarge: 'M_TOO_LARGE',

  // The resource being requested is reserved by an application service, or the application service making the request has not created the resource.
  exclusive: 'M_EXCLUSIVE',

  // The request cannot be completed because the homeserver has reached a resource limit imposed on it. For example, a homeserver held in a shared hosting environment may reach a resource limit if it starts using too much memory or disk space. The error MUST have an admin_contact field to provide the user receiving the error a place to reach out to. Typically, this error will appear on routes which attempt to modify state (e.g.: sending messages, account data, etc) and not routes which only read state (e.g.: /sync, get account data, etc).
  resourceLimitExceeded: 'M_RESOURCE_LIMIT_EXCEEDED',

  // The user is unable to reject an invite to join the server notices room. See the Server Notices module for more information.
  cannotLeaveServerNoticeRoom: 'M_CANNOT_LEAVE_SERVER_NOTICE_ROOM',

  // The registration token has been used too many times and is now invalid.
  tokenMax: 'TOKEN_USED_TOO_MANY_TIMES'
} as const

export const defaultMsg = (s: string): string => {
  return s
    .replace(/^M_/, '')
    .split('_')
    .map((s) => {
      const t = s.toLowerCase()
      return t.charAt(0).toUpperCase() + t.slice(1)
    })
    .join(' ')
}

export const errMsg = (
  code: keyof typeof errCodes,
  explanation?: string
): object => {
  const errCode = errCodes[code]
  return {
    errcode: errCode,
    error: explanation != null ? explanation : defaultMsg(errCode)
  }
}
