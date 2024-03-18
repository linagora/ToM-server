import {
  type DbGetResult,
  type MatrixDBBackend,
  type MatrixDBCollections
} from '@twake/matrix-identity-server'

type Insert = (
  table: MatrixDBCollections,
  values: Record<string, string | number>
) => Promise<DbGetResult>

export interface MatrixDBUsersBackend extends MatrixDBBackend {
  insert: Insert
}

type InsertUser = (
  values: Record<string, string | number>
) => Promise<DbGetResult>

export interface IMatrixDBUsersRepository extends MatrixDBBackend {
  insertUser: InsertUser
}
