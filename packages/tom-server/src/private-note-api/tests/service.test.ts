import privateNoteService from '../services'
import { type Note } from '../types'
import { prismaMock } from '../../../singleton'

describe('the Private Note Service', () => {
  it('should create a note', async () => {
    const sampleNote: Note = {
      id: 1,
      authorId: 'test',
      targetId: 'test',
      content: 'test'
    }

    prismaMock.note.create.mockResolvedValue(sampleNote)

    await expect(
      privateNoteService.create('test', 'test', 'test')
    ).resolves.toEqual(sampleNote)
  })

  it('should fetch a note', async () => {
    const sampleNote: Note = {
      id: 1,
      authorId: 'test',
      targetId: 'test',
      content: 'something'
    }

    prismaMock.note.findFirst.mockResolvedValue(sampleNote)

    await expect(privateNoteService.get('test', 'test')).resolves.toEqual(
      'something'
    )
  })

  it('should update a note', async () => {
    const sampleNote: Note = {
      id: 1,
      authorId: 'test',
      targetId: 'test',
      content: 'something'
    }

    prismaMock.note.findFirst.mockResolvedValue(sampleNote)
    prismaMock.note.update.mockResolvedValue({
      ...sampleNote,
      content: 'new note content'
    })

    await expect(
      privateNoteService.update(1, 'new note content')
    ).resolves.toEqual({ ...sampleNote, content: 'new note content' })
  })

  it('should delete a note', async () => {
    const sampleNote: Note = {
      id: 1,
      authorId: 'test',
      targetId: 'test',
      content: 'something'
    }

    prismaMock.note.delete.mockResolvedValue(sampleNote)

    await expect(privateNoteService.delete(1)).resolves.toEqual(sampleNote)
  })

  it('should return null if the note does not exist', async () => {
    prismaMock.note.findFirst.mockResolvedValue(null)

    await expect(privateNoteService.get('test', 'test')).resolves.toBeNull()
  })

  it('should throw an error if the note cannot be deleted', async () => {
    prismaMock.note.delete.mockRejectedValue(new Error('Some error'))

    await expect(privateNoteService.delete(1)).rejects.toThrow(
      'Failed to delete note'
    )
  })

  it('should throw an error if the note cannot be updated', async () => {
    prismaMock.note.findFirst.mockRejectedValue(new Error('Some random error'))

    await expect(
      privateNoteService.update(1, 'new note content')
    ).rejects.toThrow('Failed to update note')
  })

  it('should throw an error if the note cannot be created', async () => {
    prismaMock.note.create.mockRejectedValue(new Error('Some random error'))

    await expect(
      privateNoteService.create('test', 'test', 'test')
    ).rejects.toThrow('Failed to create note')
  })
})
