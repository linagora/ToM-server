import { type Config as MASConfig } from '@twake/matrix-application-server'
import {
  type IdentityServerDb,
  type Config as MConfig,
  type Utils as MUtils
} from '@twake/matrix-identity-server'
import {
  type expressAppHandler as _expressAppHandler,
  errCodes
} from '@twake/utils'
import { type NextFunction, type Request, type Response } from 'express'
import type { PathOrFileDescriptor } from 'fs'
import type { SendMailOptions } from 'nodemailer'

export type expressAppHandler = _expressAppHandler
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
    opensearch_ca_cert_path?: string
    opensearch_host?: string
    opensearch_is_activated?: boolean
    opensearch_max_retries?: number
    opensearch_number_of_shards?: number
    opensearch_number_of_replicas?: number
    opensearch_password?: string
    opensearch_ssl?: boolean
    opensearch_user?: string
    opensearch_wait_for_active_shards?: string
    sms_api_key?: string
    sms_api_login?: string
    sms_api_url?: string
    qr_code_url?: string
    invitation_redirect_url?: string
    chat_url?: string
    auth_url?: string
    matrix_admin_login: string
    matrix_admin_password: string
    admin_access_token: string
    signup_url: string
    twake_chat: TwakeChatEnvironmentConfig
    room_permissions: {
      direct_chat: PowerLevelEventContent
      private_group_chat: PowerLevelEventContent
      public_group_chat: PowerLevelEventContent
      private_channel: PowerLevelEventContent
      public_channel: PowerLevelEventContent
    }
  }

export interface AuthRequest extends Request {
  userId?: string
  accessToken?: string
}

export type ConfigurationFile = object | PathOrFileDescriptor | undefined

export const allMatrixErrorCodes = {
  ...errCodes
} as const

export type TwakeDB = IdentityServerDb<twakeDbCollections>

export type twakeDbCollections =
  | 'recoveryWords'
  | 'matrixTokens'
  | 'privateNotes'
  | 'roomTags'
  | 'userQuotas'
  | 'rooms'
  | 'invitations'
  | 'addressbooks'
  | 'contacts'

export type ApiRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void

export interface OIDCRedirectResponse {
  location: string
  cookies: string
}

export interface ITokenService {
  getAccessTokenWithCookie: (cookies: string) => Promise<string | null>
  getAccessTokenWithCreds: (
    username: string,
    password: string
  ) => Promise<string | null>
  requestAccessToken: (loginToken: string) => Promise<string | null>
  getOidcProvider: () => Promise<string | null>
  getOidcRedirectLocation: (
    oidcProvider: string
  ) => Promise<OIDCRedirectResponse | null>
  getLoginToken: (
    location: string,
    sessionCookies: string,
    authCookie: string
  ) => Promise<string | null>
}

export interface TokenLoginPayload {
  initial_device_display_name: string
  token: string
  type: string
}

export interface GenericResponse {
  errcode?: string
  error?: string
}

export interface TokenLoginResponse extends GenericResponse {
  access_token: string
  device_id: string
  expires_in_ms: number
  home_server: string
  refresh_token: string
  user_id: string
  well_known?: object
}

export interface loginFlowsResponse extends GenericResponse {
  flows: LoginFlow[]
}

export interface LoginFlow {
  type: string
  identity_providers?: IdentityProvider[]
}

export interface IdentityProvider {
  name: string
  id: string
}

export interface AuthAPIResponse {
  error: string
  result: number
}

export interface AuthResponse extends AuthAPIResponse {
  id: string
}

export interface TokenResponse extends AuthAPIResponse {
  token: string
}

export interface INotificationService {
  emailFrom: string
  sendEmail: (options: SendMailOptions) => Promise<void>
  sendSMS: (to: string, body: string) => Promise<void>
}

export interface SendSmsPayload {
  text: string
  recipients: Recipient[]
  sender: string
}

interface Recipient {
  phone_number: string
}

export interface ISMSService {
  send: (to: string, body: string) => Promise<void>
}

export interface IEmailService {
  from: string
  send: (options: SendMailOptions) => Promise<void>
}

export interface MailerConfig {
  host: string
  port: number
  auth?: Record<string, string>
  secure?: boolean
  tls?: {
    rejectUnauthorized: boolean
  }
}

export interface TwakeChatEnvironmentConfig {
  application_name: string
  application_welcome_message: string
  privacy_url: string
  render_html: boolean
  hide_redacted_events: boolean
  hide_unknown_events: boolean
  issue_id: string
  registration_url: string
  twake_workplace_homeserver: string
  app_grid_dashboard_available: boolean
  platform: string
  default_max_upload_avatar_size_in_bytes: string
  dev_mode: boolean
  qr_code_download_url: string
  enable_logs: boolean
  support_url: string
  enable_invitations: boolean
}

export interface TwakeChatConfig extends TwakeChatEnvironmentConfig {
  default_homeserver: string
  homeserver: string
}

export interface CreateRoomPayload {
  creation_content: CreationContent
  initial_state: StateEvent[]
  invite: string[]
  invite_3pid: Invite3pid[]
  is_direct: boolean
  name: string
  power_level_content_override: PowerLevelEventContent
  preset: 'private_chat' | 'public_chat' | 'trusted_private_chat'
  room_alias_name: string
  room_version: string
  topic: string
  visibility: 'public' | 'private'
}

export type CreationContent = Content

export interface StateEvent {
  content: Content
  state_key?: string
  type: string
}

export interface Invite3pid {
  address: string
  id_access_token: string
  id_server: string
  medium: string
}

export interface PowerLevelEventContent {
  users_default: number
  events_default: number
  invite: number
  state_default: number
  kick: number
  ban: number
  redact: number
  notifications: {
    room: number
  }
  events: {
    'm.reaction': number
    'm.room.redaction': number
    'm.room.pinned_events': number
    'org.matrix.msc3401.call': number
    'org.matrix.msc3401.call.member': number
    'm.room.name': number
    'm.room.topic': number
    'm.room.avatar': number
    'm.room.history_visibility': number
    'm.room.power_levels': number
    'm.room.encryption': number
  }
}

export type Content = Record<
  string,
  string[] | string | number | boolean | Object
>
