import { type DbGetResult } from '@twake/matrix-identity-server'

export interface IMatrixDBRepository {
  addMatrixUserAdmin: (matrixAddress: string) => Promise<DbGetResult>
  hasRoomLocalServerUsers: (roomId: string) => Promise<boolean>
}
