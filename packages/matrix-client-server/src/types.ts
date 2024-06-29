import { type Config as MIdentityServerConfig } from '@twake/matrix-identity-server'

export type Config = MIdentityServerConfig & {
  matrix_server: string
}

export type Collections = MIdentityServerDb.Collections

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
