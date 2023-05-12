import type { PathOrFileDescriptor } from 'fs'
import {
  type IdentityServerDb as MIdentityServerDb,
  type Config as MConfig,
  type Utils as MUtils
} from '@twake/matrix-identity-server'

import { type Request } from 'express'

export type expressAppHandler = MUtils.expressAppHandler
export type AuthenticationFunction = MUtils.AuthenticationFunction

export type Config = MConfig & {
  jitsiBaseUrl: string
  jitsiJwtAlgorithm: string
  jitsiJwtIssuer: string
  jitsiJwtSecret: string
  jitsiPreferredDomain: string
  jitsiUseJwt: boolean
  matrix_server: string
  matrix_database_host: string
  oidc_issuer?: string
}

export type IdentityServerDb = MIdentityServerDb.default
export type Collections = MIdentityServerDb.Collections

export interface AuthRequest extends Request {
  userId?: string
  accessToken?: string
}

export type ConfigurationFile = object | PathOrFileDescriptor | undefined
