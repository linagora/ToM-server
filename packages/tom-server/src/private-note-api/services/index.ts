import { type TwakeDB } from '../../types'
import type { IPrivateNoteService, Note } from '../types'

class PrivateNoteService implements IPrivateNoteService {
  constructor(private readonly db: TwakeDB) {}
  /**
   * Get a note by author and target
   *
   * @param {string} authorId -  The id of the author
   * @param {string} targetId - The id of the target
   * @returns {Promise<string | null>} The note content
   */
  public get = async (
    authorId: string,
    targetId: string
  ): Promise<string | null> => {
    try {
      const notes = (await this.db.get('privateNotes', ['content'], {
        authorId
      })) as unknown as Note[]

      const note = notes.find((note) => note.targetId === targetId)

      if (note === undefined) {
        return null
      }

      return note.content
    } catch (error) {
      /* istanbul ignore next */
      throw new Error('Failed to get note', { cause: error })
    }
  }

  /**
   * Create a note
   *
   * @param {string} authorId - The id of the author
   * @param {string} targetId - The id of the target
   * @param {string} content -  The note content
   */
  public create = async (
    authorId: string,
    targetId: string,
    content: string
  ): Promise<void> => {
    try {
      const notes = (await this.db.get('privateNotes', ['content'], {
        authorId
      })) as unknown as Note[]

      const existingNote = notes.find((note) => note.targetId === targetId)

      /* istanbul ignore if */
      if (existingNote !== undefined) {
        throw new Error('Note already exists')
      }

      await this.db.insert('privateNotes', {
        authorId,
        targetId,
        content
      })
    } catch (error) {
      throw new Error('Failed to create note', { cause: error })
    }
  }

  /**
   * Update a note
   *
   * @param {number} id - The id of the note
   * @param {string} content -  The new note content
   */
  public update = async (id: number, content: string): Promise<void> => {
    try {
      const existingNoteCount = await this.db.getCount('privateNotes', 'id', id)

      /* istanbul ignore if */
      if (existingNoteCount === 0) {
        throw new Error('Note not found')
      }

      await this.db.update('privateNotes', { content }, 'id', id)
    } catch (error) {
      throw new Error('Failed to update note', { cause: error })
    }
  }

  /**
   * Delete a note
   *
   * @param {number} id - The id of the note
   */
  public delete = async (id: number): Promise<void> => {
    try {
      const existingNoteCount = await this.db.getCount('privateNotes', 'id', id)

      /* istanbul ignore if */
      if (existingNoteCount === 0) {
        throw new Error('Note not found')
      }

      await this.db.deleteEqual('privateNotes', 'id', id)
    } catch (error) {
      throw new Error('Failed to delete note', { cause: error })
    }
  }
}

export default PrivateNoteService
