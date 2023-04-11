import { type SupportedDatabases } from './db'

export interface Config {
  database_engine: SupportedDatabases
  database_host: string
  server_name: string
}
