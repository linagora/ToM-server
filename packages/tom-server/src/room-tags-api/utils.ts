import type { MatrixDBBackend } from '@twake/matrix-identity-server'
import type { RoomMembership, RoomTag } from './types'
import type { IdentityServerDb } from '../types'

/**
 * checks whether a user is a member of a room
 *
 * @param {MatrixDBBackend} db - the matrix server database
 * @param {string} userId - the user id
 * @param {sting} roomId - the room id
 * @returns {Promise<boolean>}
 */
export const isMemberOfRoom = async (
  db: MatrixDBBackend,
  userId: string,
  roomId: string
): Promise<boolean> => {
  const memberships = (await db.get(
    'room_memberships',
    ['room_id'],
    'user_id',
    userId
  )) as unknown as Array<Partial<RoomMembership>>

  return memberships.some((m) => m.room_id === roomId)
}

/**
 * Checks whether a user has a tag for a room
 *
 * @param {IdentityServerDb} db - the identity server database
 * @param {string} userId - the user id
 * @param {string} roomId - the room id
 * @returns {Promise<boolean>}
 */
export const userRoomTagExists = async (
  db: IdentityServerDb,
  userId: string,
  roomId: string
): Promise<boolean> => {
  return (await getRoomTagId(db, userId, roomId)) !== null
}

/**
 * Returns the id for a room tag
 *
 * @param {IdentityServerDb} db - the identity server database database
 * @param {string} userId - the user id
 * @param {string} roomId - the room id
 * @returns {string | null}
 */
export const getRoomTagId = async (
  db: IdentityServerDb,
  userId: string,
  roomId: string
): Promise<string | null> => {
  const userTags = (await db.get(
    'roomTags',
    ['id', 'roomId'],
    'authorId',
    userId
  )) as unknown as RoomTag[]

  const roomTag = userTags.find((t) => t.roomId === roomId)

  if (roomTag === undefined) {
    return null
  }

  return roomTag.id as string
}
