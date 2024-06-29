import { type TwakeDB } from '../../types'
import type { IRoomTagsService, RoomTag } from '../types'
import { getRoomTagId, userRoomTagExists } from '../utils'

class RoomTagsService implements IRoomTagsService {
  constructor(private readonly db: TwakeDB) {}

  /**
   * Fetches the tags of a room.
   *
   * @param {string} authorId - the author of the tag
   * @param {string} roomId - the room id
   * @returns {Promise<RoomTag | null>}
   */
  get = async (authorId: string, roomId: string): Promise<RoomTag | null> => {
    try {
      const userTags = await this.db.get(
        'roomTags',
        ['roomId', 'content', 'authorId'],
        { authorId }
      )

      const roomTag = userTags.find((tag) => tag.roomId === roomId)

      if (roomTag === undefined) {
        return null
      }

      return {
        ...roomTag,
        content: JSON.parse(roomTag.content as string)
      } as unknown as RoomTag
    } catch (error) {
      throw Error('Failed to fetch room tags', { cause: error })
    }
  }

  /**
   * Creates a new room tag.
   *
   * @param {RoomTag} tag - the room tag to create
   */
  create = async (tag: RoomTag): Promise<void> => {
    try {
      const { content } = tag

      await this.db.insert('roomTags', {
        ...tag,
        content: JSON.stringify(content)
      })
    } catch (error) {
      throw Error('Failed to create room tags', { cause: error })
    }
  }

  /**
   * Updates room tags for a user.
   *
   * @param {string} authorId - the author id
   * @param {string} roomId - the room id
   * @param {string[]} content - the new tags list
   */
  update = async (
    authorId: string,
    roomId: string,
    content: string[]
  ): Promise<void> => {
    try {
      if (!(await userRoomTagExists(this.db, authorId, roomId))) {
        throw Error('Room tag does not exist')
      }

      const id = await getRoomTagId(this.db, authorId, roomId)

      if (id === null) {
        throw Error('Failed to get room tag id')
      }

      await this.db.update(
        'roomTags',
        { content: JSON.stringify(content) },
        'id',
        id
      )
    } catch (error) {
      throw Error('Failed to update room tags', { cause: error })
    }
  }

  /**
   * Deletes a room tag for a user.
   *
   * @param {strin} authorId - the author of the tags.
   * @param {string} roomId - the room id.
   */
  delete = async (authorId: string, roomId: string): Promise<void> => {
    try {
      if (!(await userRoomTagExists(this.db, authorId, roomId))) {
        throw Error('Room tag does not exist')
      }

      const id = await getRoomTagId(this.db, authorId, roomId)
      if (id === null) {
        throw Error('Failed to get room tag id')
      }

      await this.db.deleteEqual('roomTags', 'id', id)
    } catch (error) {
      throw Error('Failed to delete room tags', { cause: error })
    }
  }
}

export default RoomTagsService
