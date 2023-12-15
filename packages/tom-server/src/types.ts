import { type Config as MASConfig } from '@twake/matrix-application-server'
import type MatrixIdentityServer from '@twake/matrix-identity-server'
import {
  MatrixErrors,
  type Config as MConfig,
  type IdentityServerDb as MIdentityServerDb,
  type Utils as MUtils
} from '@twake/matrix-identity-server'
import type { PathOrFileDescriptor } from 'fs'
import type AugmentedIdentityServer from './identity-server'
import { type Request } from 'express'

export type expressAppHandler = MUtils.expressAppHandler
export type AuthenticationFunction = MUtils.AuthenticationFunction

export type Config = MConfig &
  MASConfig & {
    jitsiBaseUrl: string
    jitsiJwtAlgorithm: string
    jitsiJwtIssuer: string
    jitsiJwtSecret: string
    jitsiPreferredDomain: string
    jitsiUseJwt: boolean
    matrix_server: string
    matrix_database_host: string
    oidc_issuer?: string
    enable_company_features?: boolean
    sms_api_key?: string
    sms_api_login?: string
    sms_api_url?: string
  }

export type IdentityServerDb = MIdentityServerDb.default
export type Collections = MIdentityServerDb.Collections

export interface AuthRequest extends Request {
  userId?: string
  accessToken?: string
}

export type ConfigurationFile = object | PathOrFileDescriptor | undefined

export type TwakeIdentityServer = AugmentedIdentityServer | MatrixIdentityServer

export const allMatrixErrorCodes = {
  ...MatrixErrors.errCodes,
  // The access or refresh token specified was not recognised
  // An additional response parameter, soft_logout, might be present on the response for 401 HTTP status codes
  unknownToken: 'M_UNKNOWN_TOKEN',

  // No access token was specified for the request
  missingToken: 'M_MISSING_TOKEN',

  // Request contained valid JSON, but it was malformed in some way, e.g. missing required keys, invalid values for keys
  badJson: 'M_BAD_JSON',

  // Request did not contain valid JSON
  notJson: 'M_NOT_JSON',

  // No resource was found for this request
  notFound: 'M_NOT_FOUND',

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
  cannotLeaveServerNoticeRoom: 'M_CANNOT_LEAVE_SERVER_NOTICE_ROOM'
} as const
