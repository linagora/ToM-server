import { type SupportedDatabases } from './db'
import { type ConnectionOptions } from 'tls'
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
  database_ssl?: boolean | ConnectionOptions | undefined
  database_user?: string
  database_vacuum_delay: number
  federated_identity_services?: string[] | null
  hashes_rate_limit?: number
  invitation_server_name?: string
  is_federated_identity_service: boolean
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
  matrix_database_ssl?: boolean | ConnectionOptions | undefined
  matrix_database_user?: string | null
  pepperCron?: string
  policies?: Policies | string | null
  rate_limiting_window?: number
  rate_limiting_nb_requests?: number
  redis_uri?: string
  server_name: string
  smtp_password?: string
  smtp_port?: number
  smtp_sender?: string
  smtp_server: string
  smtp_tls?: boolean
  smtp_user?: string
  smtp_verify_certificate?: boolean
  trust_x_forwarded_for?: boolean
  update_federated_identity_hashes_cron?: string
  update_users_cron?: string
  userdb_engine?: SupportedUserDatabases
  userdb_host?: string
  userdb_name?: string
  userdb_password?: string
  userdb_ssl?: boolean | ConnectionOptions | undefined
  userdb_user?: string
  template_dir: string
  check_quota_cron?: string
  matrix_server?: string
  sms_api_login?: string
  sms_api_key?: string
  sms_api_url?: string
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

export interface ISMSService {
  send: (to: string, body: string) => Promise<void>
}
