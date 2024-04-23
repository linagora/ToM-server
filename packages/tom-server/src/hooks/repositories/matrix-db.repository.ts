import { type DbGetResult, type MatrixDB } from '@twake/matrix-identity-server'
import lodash from 'lodash'
import { type IMatrixDBRepository } from './interfaces/matrix-db-repository.interface'

const { groupBy, mapValues, escapeRegExp } = lodash

export class MatrixDBRepository implements IMatrixDBRepository {
  constructor(
    private readonly _matrixDb: MatrixDB,
    private readonly _matrixServer: string
  ) {}

  async addMatrixUserAdmin(matrixAddress: string): Promise<DbGetResult> {
    const result = await this._matrixDb.insert('users', {
      name: matrixAddress,
      admin: 1
    })
    if (result.length === 0) {
      throw new Error(`Set ${matrixAddress} as Matrix homeserver admin failed`)
    }
    return result
  }

  async hasRoomLocalServerUsers(roomId: string): Promise<boolean> {
    const userIdLocalServerRegExp = new RegExp(
      `^@[^:]*:${escapeRegExp(this._matrixServer)}$`
    )
    const localServerUsers = (
      (await this._matrixDb.get('room_memberships', ['user_id', 'membership'], {
        room_id: roomId
      })) as Array<{ user_id: string; membership: string }>
    ).filter(
      (membershipDetail) =>
        membershipDetail.user_id.match(userIdLocalServerRegExp) != null
    )

    const currentMembershipByUserId = mapValues(
      groupBy(localServerUsers, 'user_id'),
      (membershipsDetails) =>
        membershipsDetails.map((detail) => detail.membership).pop()
    )

    return Object.keys(currentMembershipByUserId).some(
      (userId) => currentMembershipByUserId[userId] !== 'leave'
    )
  }
}
