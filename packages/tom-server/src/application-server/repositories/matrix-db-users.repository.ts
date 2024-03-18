import { MatrixDB, type DbGetResult } from '@twake/matrix-identity-server'
import {
  type IMatrixDBUsersRepository,
  type MatrixDBUsersBackend
} from './interfaces/matrix-db-users-repository.interface'

export class MatrixDBUsersRepository
  extends MatrixDB
  implements IMatrixDBUsersRepository
{
  declare db: MatrixDBUsersBackend
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  insertUser(values: Record<string, string | number>): Promise<DbGetResult> {
    return this.db.insert('users', values)
  }
}
