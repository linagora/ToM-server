/* istanbul ignore file */

import {
  type IdentityServerDb,
  type Config as MIdentityServerConfig
} from '@twake/matrix-identity-server'

export type Config = MIdentityServerConfig & {
  login_flows: LoginFlowContent
  application_services: AppServiceRegistration[]
  sms_folder: string
  is_registration_enabled: boolean
  capabilities: Capabilities
  is_sso_login_enabled: boolean
  is_password_login_enabled: boolean
  is_email_login_enabled: boolean
  is_msisdn_login_enabled: boolean
  is_recaptcha_login_enabled: boolean
  is_terms_login_enabled: boolean
  is_registration_token_login_enabled: boolean
  registration_required_3pid: string[]
  user_directory: UserDirectoryConfig
  open_id_token_lifetime: number
}

export type DbGetResult = Array<
  Record<string, string | number | Array<string | number>>
>

/*
/* FILTERS */
/*

/* https://spec.matrix.org/latest/client-server-api/#post_matrixclientv3useruseridfilter */
/* https://spec.matrix.org/latest/client-server-api/#get_matrixclientv3useruseridfilterfilterid */

export interface Filter {
  account_data?: EventFilter
  event_fields?: string[]
  event_format?: string // 'client' | 'federation'
  presence?: EventFilter
  room?: RoomFilter
}

export interface EventFilter {
  limit?: number
  not_senders?: string[]
  not_types?: string[]
  senders?: string[]
  types?: string[]
}

export interface RoomFilter {
  account_data?: RoomEventFilter
  ephemeral?: RoomEventFilter
  include_leave?: boolean
  not_rooms?: string[]
  rooms?: string[]
  state?: StateFilter
  timeline?: RoomEventFilter
}

export interface RoomEventFilter extends EventFilter {
  contains_url?: boolean
  include_redundant_members?: boolean
  lazy_load_members?: boolean
  not_rooms?: string[]
  rooms?: string[]
  unread_thread_notifications?: boolean
}

export type StateFilter = RoomEventFilter

/*
/* EVENTS */
/*

/* https://spec.matrix.org/latest/client-server-api/#room-event-format */

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

export interface StateEvent extends Omit<ClientEvent, 'state_key'> {
  state_key: string
}

/* https://spec.matrix.org/latest/client-server-api/#stripped-state */
export interface StrippedStateEvent {
  content: Record<string, any>
  sender: string
  type: string
  state_key: string
}

export const stripEvent = (event: StateEvent): StrippedStateEvent => {
  return {
    content: event.content,
    sender: event.sender,
    type: event.type,
    state_key: event.state_key
  }
}

/* ROOMS */

export interface RoomMember {
  avatar_url: string
  display_name: string
}
export interface PreviousRoom {
  room_id: string
  event_id: string
}

/*
/* ROOM EVENTS */

export enum RoomEventTypes {
  Member = 'm.room.member',
  Create = 'm.room.create',
  JoinRules = 'm.room.join_rules',
  PowerLevels = 'm.room.power_levels',
  CanonicalAlias = 'm.room.canonical_alias',
  Aliases = 'm.room.aliases', // https://spec.matrix.org/v1.11/client-server-api/#historical-events
  Tombstone = 'm.room.tombstone', // https://spec.matrix.org/v1.11/client-server-api/#mroomtombstone
  Redaction = 'm.room.redaction', // https://spec.matrix.org/v1.11/client-server-api/#mroomredaction
  ThirdPartyInvite = 'm.room.third_party_invite', // https://spec.matrix.org/v1.11/client-server-api/#mroomredaction
  RoomHistoryVisibility = 'm.room.history_visibility', // https://spec.matrix.org/v1.11/client-server-api/#mroomhistory_visibility
  Encrypted = 'm.room.encrypted', // https://spec.matrix.org/v1.11/client-server-api/#mroomencrypted
  RoomAvatar = 'm.room.avatar', // https://spec.matrix.org/v1.11/client-server-api/#mroomavatar
  RoomEncryption = 'm.room.encryption', // https://spec.matrix.org/v1.11/client-server-api/#mroomencryption
  GuestAccess = 'm.room.guest_access', // https://spec.matrix.org/v1.11/client-server-api/#mroomguest_access
  Message = 'm.room.message', // https://spec.matrix.org/v1.11/client-server-api/#mroommessage
  Topic = 'm.room.topic', // https://spec.matrix.org/v1.11/client-server-api/#mroomtopic
  Name = 'm.room.name', // https://spec.matrix.org/v1.11/client-server-api/#mroomname
  ServerACL = 'm.room.server_acl', // https://spec.matrix.org/v1.11/client-server-api/#mroomserver_acl
  Pinned = 'm.room.pinned_events' // https://spec.matrix.org/v1.11/client-server-api/#mroompinned_events
}

/* m.room.canonical_alias */
/* https://spec.matrix.org/v1.11/client-server-api/#mroomcanonical_alias */

export interface RoomCanonicalAliasEvent extends StateEvent {
  content: {
    alias?: string
    alt_aliases?: string[]
  }
  state_key: ''
}

/* m.room.create */
/* https://spec.matrix.org/v1.11/client-server-api/#mroomcreate */
export interface RoomCreateEvent extends StateEvent {
  content: {
    creator?: string
    'm.federate'?: boolean
    predecessor?: PreviousRoom
    room_version?: string
    type?: string
  }
  state_key: ''
}

/* m.room.join_rules */
/* https://spec.matrix.org/v1.11/client-server-api/#mroomjoin_rules */
export interface RoomJoinRulesEvent extends StateEvent {
  content: {
    allow?: AllowCondition[]
    join_rule: string
  }
  state_key: ''
}

export interface AllowCondition {
  room_id?: string
  type: string // 'm.room_membership'
}

/* m.room.member */
/* https://spec.matrix.org/v1.11/client-server-api/#mroommember */
export interface RoomMemberEvent extends StateEvent {
  content: EventContent
}

export interface EventContent {
  avatar_url?: string
  displayname?: string | null
  is_direct?: boolean
  join_authorised_via_users_server?: string
  membership: string
  reason?: string
  third_party_invite?: Invite
}

export interface Invite {
  display_name: string
  signed: signed
}

export interface signed {
  mxid: string
  signatures: Record<string, Record<string, string>>
  token: string
}

export enum Membership {
  INVITE = 'invite',
  JOIN = 'join',
  KNOCK = 'knock',
  LEAVE = 'leave',
  BAN = 'ban'
}

/* m.room.power_levels */
/* https://spec.matrix.org/v1.11/client-server-api/#mroompower_levels */
export interface RoomPowerLevelsEvent extends StateEvent {
  content: {
    ban?: number
    events?: Record<string, number>
    events_default?: number
    invite?: number
    kick?: number
    notifications?: Notifications
    redact?: number
    state_default?: number
    users?: Record<string, number>
    users_default?: number
  }
  state_key: ''
}

export interface Notifications {
  room?: number
  [key: string]: number | undefined
}

/* General */

export interface LocalMediaRepository {
  media_id: string
  media_length: string
  user_id: string
}
export interface MatrixUser {
  name: string
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

/* https://spec.matrix.org/v1.11/client-server-api/#identifier-types */
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

/* https://spec.matrix.org/v1.11/client-server-api/#authentication-types */
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
  id_server?: string
  id_access_token?: string
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
interface SsoAuth {
  type: 'm.login.sso'
  session: string
}

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

export interface ApplicationServiceAuth {
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
  | SsoAuth

export interface AuthenticationFlowContent {
  flows: flowContent
  params: Record<string, any> // TODO : Fix any typing when we implement params for authentication types other than m.login.terms
}

export type flowContent = stagesContent[]

export interface LoginFlowContent {
  flows: LoginFlow[]
}

interface stagesContent {
  stages: AuthenticationTypes[]
}

interface LoginFlow {
  get_login_token?: string
  type: AuthenticationTypes
}

/* https://spec.matrix.org/v1.11/application-service-api/#registration */
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

/* https://spec.matrix.org/latest/client-server-api/#capabilities-negotiation */

interface Capabilities {
  enable_set_displayname?: boolean
  enable_set_avatar_url?: boolean
  enable_3pid_changes?: boolean
  enable_change_password?: boolean
  enable_account_validity?: boolean
}

interface UserDirectoryConfig {
  enable_all_users_search?: boolean
}
