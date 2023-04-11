import { type Config } from '../utils'

export interface ITableDetail {
  title: string
}

export const recoveryWords: ITableDetail = {
  title: 'recoveryWords'
}

type Insert = (table: string, values: Record<string, string>) => Promise<void>
type Get = (
  table: string,
  fields: string[],
  field: string,
  value: string | number
) => Promise<Array<Record<string, string | number>>>

export interface VaultDbBackend {
  ready: Promise<void>
  createDatabases: (conf: Config) => Promise<boolean>
  insert: Insert
  get: Get
}
