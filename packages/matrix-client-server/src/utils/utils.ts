import type MatrixClientServer from '..'
import { type DbGetResult } from '../types'

export const isAdmin = async (
  clientServer: MatrixClientServer,
  userId: string
): Promise<boolean> => {
  try {
    const response: DbGetResult = await clientServer.matrixDb.get(
      'users',
      ['admin'],
      {
        name: userId
      }
    )
    return response.length > 0 && response[0].admin === 1
  } catch (e) {
    clientServer.logger.error('Error checking admin', e)
    return false
  }
}
