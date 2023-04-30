import type { Note, IPrivateNoteService } from '../types'
import prisma from '../../prisma/client'

class PrivateNoteService implements IPrivateNoteService {
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
      const note = await prisma.note.findFirst({
        where: {
          authorId,
          targetId
        }
      })

      if (note === null) {
        return null
      }

      return note.content
    } catch (error) {
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
  ): Promise<Note> => {
    try {
      const existingNote = await prisma.note.findFirst({
        where: {
          authorId,
          targetId
        }
      })

      if (existingNote != null) {
        throw new Error('Note already exists')
      }

      const newNote = await prisma.note.create({
        data: {
          authorId,
          targetId,
          content
        }
      })

      if (newNote == null) {
        throw new Error('Note not created')
      }

      return newNote
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
  public update = async (id: number, content: string): Promise<Note> => {
    try {
      const existingNote = await prisma.note.findFirst({
        where: {
          id
        }
      })

      if (existingNote == null) {
        throw new Error('Note not found')
      }

      const updatedNote = await prisma.note.update({
        where: {
          id
        },
        data: {
          content
        }
      })

      /* istanbul ignore if */
      if (updatedNote == null) {
        throw new Error('Note not updated')
      }

      return updatedNote
    } catch (error) {
      throw new Error('Failed to update note', { cause: error })
    }
  }

  /**
   * Delete a note
   *
   * @param {number} id - The id of the note
   */
  public delete = async (id: number): Promise<Note> => {
    try {
      const deletedNote = await prisma.note.delete({
        where: {
          id
        }
      })

      if (deletedNote == null) {
        throw new Error('Note not deleted')
      }

      return deletedNote
    } catch (error) {
      throw new Error('Failed to delete note', { cause: error })
    }
  }
}

export default new PrivateNoteService()
