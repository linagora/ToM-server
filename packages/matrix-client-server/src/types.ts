// istanbul ignore file
import {
  type IdentityServerDb,
  type Config as MIdentityServerConfig
} from '@twake/matrix-identity-server'
import { type Policies } from '@twake/matrix-identity-server/dist/terms'

// TODO : Put Policies in types.ts of matrix-identity-server to export it in the @twake/matrix-identity-server module and not in the dist/terms
export type Config = MIdentityServerConfig & {
  login_flows: loginFlowContent
  authentication_flows: authenticationFlowContent
  application_services: AppServiceRegistration[]
  sms_folder: string
  is_registration_enabled: boolean
  sms_folder: string
  is_registration_enabled: boolean
}

export type DbGetResult = Array<
  Record<string, string | number | Array<string | number>>
>

export interface ClientEvent {
  content: Record<string, any>
  event_id: string
  origin_server_ts: number
  room_id: string
  sender: string
  state_key?: string
  type: string
  unsigned?: UnsignedData
}
export interface EventContent {
  avatar_url?: string
  displayname?: string | null
  is_direct?: boolean
  join_authorised_via_users_server?: boolean
  membership: string
  reason?: string
  third_party_invite?: Record<string, any>
}

export interface EventFilter {
  limit?: number
  not_senders?: string[]
  not_types?: string[]
  senders?: string[]
  types?: string[]
}
export interface Invite {
  display_name: string
  signed: signed
}
export interface LocalMediaRepository {
  media_id: string
  media_length: string
  user_id: string
}
export interface MatrixUser {
  name: string
}
export interface RoomEventFilter extends EventFilter {
  contains_url?: boolean
  include_redundant_members?: boolean
  lazy_load_members?: boolean
  unread_thread_notifications?: boolean
}
export interface RoomFilter {
  account_data?: RoomEventFilter
  ephemeral?: RoomEventFilter
  include_leave?: boolean
  not_rooms?: string[]
  rooms?: string[]
  state?: RoomEventFilter
  timeline?: RoomEventFilter
}
export interface RoomMember {
  avatar_url: string
  display_name: string
}
export interface signed {
  mxid: string
  signatures: Record<string, Record<string, string>>
  token: string
}
export interface UnsignedData {
  age?: number
  membership?: string
  prev_content?: Record<string, any>
  redacted_because?: ClientEvent
  transaction_id?: string
}

export interface UserQuota {
  user_id: string
  size: number
}

export type clientDbCollections = 'ui_auth_sessions'

export type ClientServerDb = IdentityServerDb<clientDbCollections>

// Based on https://spec.matrix.org/v1.11/client-server-api/#identifier-types

export interface MatrixIdentifier {
  type: 'm.id.user'
  user: string
}

export interface ThirdPartyIdentifier {
  type: 'm.id.thirdparty'
  medium: string
  address: string
}

export interface PhoneIdentifier {
  type: 'm.id.phone'
  country: string
  phone: string
}

export type UserIdentifier =
  | MatrixIdentifier
  | ThirdPartyIdentifier
  | PhoneIdentifier

// Based on https://spec.matrix.org/v1.11/client-server-api/#authentication-types
export type AuthenticationTypes =
  | 'm.login.password'
  | 'm.login.email.identity'
  | 'm.login.msisdn'
  | 'm.login.recaptcha'
  | 'm.login.sso'
  | 'm.login.dummy'
  | 'm.login.registration_token'
  | 'm.login.terms'
  | 'm.login.application_service'

interface PasswordAuth {
  type: 'm.login.password'
  identifier: UserIdentifier
  password: string
  session: string
}

export interface ThreepidCreds {
  sid: string
  client_secret: string
  id_server: string
  id_access_token: string
}

interface EmailAuth {
  type: 'm.login.email.identity'
  threepid_creds: ThreepidCreds
  session: string
}

interface PhoneAuth {
  type: 'm.login.msisdn'
  threepid_creds: ThreepidCreds
  session: string
}

interface RecaptchaAuth {
  type: 'm.login.recaptcha'
  response: string
  session: string
}

// TODO : Implement fallback to handle SSO authentication : https://spec.matrix.org/v1.11/client-server-api/#fallback
// interface SsoAuth {
//   type: AuthenticationTypes.Sso
//   session: string
// }

interface DummyAuth {
  type: 'm.login.dummy'
  session: string
}

interface TokenAuth {
  type: 'm.login.registration_token'
  token: string
  session: string
}

interface TermsAuth {
  type: 'm.login.terms'
  session: string
}

interface ApplicationServiceAuth {
  type: 'm.login.application_service'
  username: string
}

export type AuthenticationData =
  | PasswordAuth
  | EmailAuth
  | PhoneAuth
  | RecaptchaAuth
  | DummyAuth
  | TokenAuth
  | TermsAuth
  | ApplicationServiceAuth

export interface authenticationFlowContent {
  flows: flowContent
  params: Record<string, { policies: Policies }> // For now, only Terms registration gives additional parameters in the request body so the params have this type.
  // If another authentication type returns additional parameters, Policies needs to be changed to a more general type}
}

export type flowContent = stagesContent[]

export interface loginFlowContent {
  flows: LoginFlow[]
}

interface stagesContent {
  stages: AuthenticationTypes[]
}

interface LoginFlow {
  get_login_token?: string
  type: AuthenticationTypes
}

// https://spec.matrix.org/v1.11/application-service-api/#registration
export interface AppServiceRegistration {
  as_token: string
  hs_token: string
  id: string
  namespaces: Namespaces
  protocols?: string[]
  rate_limited?: boolean
  sender_localpart: string
  url: string
}

interface Namespaces {
  alias?: Namespace[]
  rooms?: Namespace[]
  users?: Namespace[]
}

interface Namespace {
  exclusive: boolean
  regex: string
}
