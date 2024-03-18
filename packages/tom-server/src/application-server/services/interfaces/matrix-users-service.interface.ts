import { type DbGetResult } from '@twake/matrix-identity-server'

export interface IMatrixUsersService {
  ready: Promise<void>
  setUserAsAdmin: (matrixAddress: string) => Promise<DbGetResult>
  close: () => void
}
