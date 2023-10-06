import {
  type Config as MConfig,
  type IdentityServerDb as MIdentityServerDb
} from '@twake/matrix-identity-server'

export type Config = MConfig & {
  trusted_servers_addresses: string[]
}

export type IdentityServerDb = MIdentityServerDb.default

export type Collections = MIdentityServerDb.Collections
