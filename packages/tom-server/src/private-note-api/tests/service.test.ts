import { type IdentityServerDb } from '../../types'
import PrivateNoteService from '../services'
import { type Note } from '../types'

describe('the Private Note Service', () => {
  const dbMock = {
    get: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    deleteEqual: jest.fn(),
    getCount: jest.fn()
  }

  const privateNoteServiceMock = new PrivateNoteService(
    dbMock as unknown as IdentityServerDb
  )

  it('should create a note', async () => {
    dbMock.get.mockResolvedValue([])
    dbMock.insert.mockResolvedValue(undefined)

    await expect(
      privateNoteServiceMock.create('testauthor', 'testtarget', 'testcontent')
    ).resolves.not.toThrow()

    expect(dbMock.insert).toHaveBeenCalledWith('privateNotes', {
      authorId: 'testauthor',
      targetId: 'testtarget',
      content: 'testcontent'
    })
  })

  it('should fetch a note', async () => {
    const sampleNote: Note = {
      id: 1,
      authorId: 'test',
      targetId: 'test',
      content: 'something'
    }

    dbMock.get.mockResolvedValue([sampleNote])

    await expect(privateNoteServiceMock.get('test', 'test')).resolves.toEqual(
      'something'
    )

    expect(dbMock.get).toHaveBeenCalledWith(
      'privateNotes',
      ['content'],
      'authorId',
      'test'
    )
  })

  it('should update a note', async () => {
    dbMock.getCount.mockResolvedValue(1)
    dbMock.update.mockResolvedValue(undefined)

    await expect(
      privateNoteServiceMock.update(1, 'new note content')
    ).resolves.not.toThrow()

    expect(dbMock.update).toHaveBeenCalledWith(
      'privateNotes',
      { content: 'new note content' },
      'id',
      1
    )
  })

  it('should delete a note', async () => {
    dbMock.getCount.mockResolvedValue(1)

    await expect(privateNoteServiceMock.delete(1)).resolves.not.toThrow()

    expect(dbMock.deleteEqual).toHaveBeenCalledWith('privateNotes', 'id', 1)
  })

  it('should return null if the note does not exist', async () => {
    dbMock.get.mockResolvedValue([])

    await expect(privateNoteServiceMock.get('test', 'test')).resolves.toBeNull()
  })

  it('should throw an error if the note cannot be deleted', async () => {
    dbMock.deleteEqual.mockRejectedValue(new Error('Some error'))

    await expect(privateNoteServiceMock.delete(1)).rejects.toThrow(
      'Failed to delete note'
    )
  })

  it('should throw an error if the note cannot be updated', async () => {
    dbMock.getCount.mockRejectedValue(new Error('Some random error'))

    await expect(
      privateNoteServiceMock.update(1, 'new note content')
    ).rejects.toThrow('Failed to update note')
  })

  it('should throw an error if the note cannot be created', async () => {
    dbMock.insert.mockRejectedValue(new Error('Some random error'))

    await expect(
      privateNoteServiceMock.create('test', 'test', 'test')
    ).rejects.toThrow('Failed to create note')
  })
})
