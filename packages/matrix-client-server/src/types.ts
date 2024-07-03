import {
  type IdentityServerDb,
  type Config as MIdentityServerConfig
} from '@twake/matrix-identity-server'

export type Config = MIdentityServerConfig & {
  matrix_server: string
  flows: flowContent
  params: any
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

enum IdentifierTypes {
  Matrix = 'm.id.user',
  ThirdParty = 'm.id.thirdparty',
  Phone = 'm.id.phone'
}

export interface MatrixIdentifier {
  type: IdentifierTypes.Matrix
  user: string
}

export interface ThirdPartyIdentifier {
  type: IdentifierTypes.ThirdParty
  medium: string
  address: string
}

export interface PhoneIdentifier {
  type: IdentifierTypes.Phone
  country: string
  phone: string
}

export type UserIdentifier =
  | MatrixIdentifier
  | ThirdPartyIdentifier
  | PhoneIdentifier

// Based on https://spec.matrix.org/v1.11/client-server-api/#authentication-types
export enum AuthenticationTypes {
  Password = 'm.login.password',
  Email = 'm.login.email.identity',
  Phone = 'm.login.msisdn',
  Recaptcha = 'm.login.recaptcha',
  Sso = 'm.login.sso',
  Dummy = 'm.login.dummy',
  Token = 'm.login.registration_token',
  Terms = 'm.login.terms'
}

interface PasswordAuth {
  type: AuthenticationTypes.Password
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
  type: AuthenticationTypes.Email
  threepid_creds: ThreepidCreds
  session: string
}

interface PhoneAuth {
  type: AuthenticationTypes.Phone
  threepid_creds: ThreepidCreds
  session: string
}

interface RecaptchaAuth {
  type: AuthenticationTypes.Recaptcha
  response: string
  session: string
}

// TODO : Implement fallback to handle SSO authentication : https://spec.matrix.org/v1.11/client-server-api/#fallback
// interface SsoAuth {
//   type: AuthenticationTypes.Sso
//   session: string
// }

interface DummyAuth {
  type: AuthenticationTypes.Dummy
  session: string
}

interface TokenAuth {
  type: AuthenticationTypes.Token
  token: string
  session: string
}

interface TermsAuth {
  type: AuthenticationTypes.Terms
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

type flowContent = stagesContent[]

interface stagesContent {
  stages: AuthenticationTypes[]
}
