import {
  type IdentityServerDb as MIdentityServerDb,
  type Config as MConfig,
  type Utils as MUtils
} from '@twake/matrix-identity-server'

export type expressAppHandler = MUtils.expressAppHandler
export type AuthenticationFunction = MUtils.AuthenticationFunction

export type Config = MConfig & {
  matrix_server: string
}

export type IdentityServerDb = MIdentityServerDb.default
