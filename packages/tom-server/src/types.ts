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
import { type Request } from 'express'
import type { PathOrFileDescriptor } from 'fs'

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
