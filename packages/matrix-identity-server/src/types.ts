import { type SupportedDatabases } from './db'
import { type Policies } from './terms'
import { type SupportedUserDatabases } from './userdb'

export interface Config {
  additional_features?: boolean
  base_url: string
  cache_engine?: string
  cache_ttl?: number
  cron_service: boolean
  database_engine: SupportedDatabases
  database_host: string
  database_name?: string
  database_password?: string
  database_ssl?: boolean | null
  database_user?: string
  database_vacuum_delay: number
  federation_server?: string | null
  is_federation_server: boolean
  key_delay: number
  keys_depth: number
  ldap_filter?: string
  ldap_base?: string
  ldap_password?: string
  ldap_uri?: string
  ldap_user?: string
  ldap_uid_field?: string
  ldapjs_opts?: Record<string, any>
  mail_link_delay: number
  matrix_database_engine?: SupportedDatabases | null
  matrix_database_host?: string | null
  matrix_database_name?: string | null
  matrix_database_password?: string | null
  matrix_database_ssl?: boolean | null
  matrix_database_user?: string | null
  pepperCron?: string
  policies?: Policies | string | null
  redis_uri?: string
  server_name: string
  smtp_password?: string
  smtp_port?: number
  smtp_sender?: string
  smtp_server: string
  smtp_tls?: boolean
  smtp_user?: string
  smtp_verify_certificate?: boolean
  update_federation_hashes_cron?: string
  update_users_cron?: string
  userdb_engine?: SupportedUserDatabases
  userdb_host?: string
  userdb_name?: string
  userdb_password?: string
  userdb_ssl?: boolean | null
  userdb_user?: string
  template_dir: string
  check_quota_cron?: string
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
