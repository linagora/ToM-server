// istanbul ignore file
import {
  type IdentityServerDb,
  type Config as MIdentityServerConfig
} from '@twake/matrix-identity-server'
import { type Policies } from '@twake/matrix-identity-server/dist/terms'

export type Config = MIdentityServerConfig & {
  flows: Array<Record<string, string[]>> // those two types will be changed later on
  //  TODO : Correct typing
  params: Record<string, Policies>
}

export type DbGetResult = Array<
  Record<string, string | number | Array<string | number>>
>

export interface LocalMediaRepository {
  media_id: string
  media_length: string
  user_id: string
}

export interface MatrixUser {
  name: string
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

interface PasswordAuth {
  type: 'm.login.password'
  identifier: UserIdentifier
  password: string
  session: string
}

interface ThreepidCreds {
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

export type AuthenticationData =
  | PasswordAuth
  | EmailAuth
  | PhoneAuth
  | RecaptchaAuth
  | DummyAuth
  | TokenAuth
  | TermsAuth

export type flowContent = stagesContent[]

interface stagesContent {
  stages: AuthenticationTypes[]
}
