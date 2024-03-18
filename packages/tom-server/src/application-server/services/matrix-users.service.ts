import { type DbGetResult } from '@twake/matrix-identity-server'
import { type IMatrixDBUsersRepository } from '../repositories/interfaces/matrix-db-users-repository.interface'
import { type IMatrixUsersService } from './interfaces/matrix-users-service.interface'

export class MatrixUsersService implements IMatrixUsersService {
  ready: Promise<void>

  constructor(
    private readonly _matrixDbUsersRepository: IMatrixDBUsersRepository
  ) {
    this.ready = this._matrixDbUsersRepository.ready
  }

  async setUserAsAdmin(matrixAddress: string): Promise<DbGetResult> {
    return await this._matrixDbUsersRepository.insertUser({
      name: matrixAddress,
      admin: 1
    })
  }

  close(): void {
    this._matrixDbUsersRepository.close()
  }
}
