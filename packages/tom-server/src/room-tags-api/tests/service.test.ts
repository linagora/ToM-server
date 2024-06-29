import { type TwakeDB } from '../../types'
import RoomTagsService from '../services'

describe('the room tags API service', () => {
  const dbMock = {
    get: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    deleteEqual: jest.fn(),
    getCount: jest.fn()
  }

  const roomTagsServiceMock = new RoomTagsService(dbMock as unknown as TwakeDB)

  it('should get a room tag', async () => {
    const roomTag = {
      id: '1',
      roomId: 'testroom',
      userId: 'testauthor',
      content: '["tag1"]'
    }

    dbMock.get.mockResolvedValue([roomTag])

    const result = await roomTagsServiceMock.get('testauthor', 'testroom')

    expect(result).toEqual({ ...roomTag, content: ['tag1'] })
    expect(dbMock.get).toHaveBeenCalledWith(
      'roomTags',
      ['roomId', 'content', 'authorId'],
      { authorId: 'testauthor' }
    )
  })

  it('should create a room tag', async () => {
    const payload = {
      authorId: 'testauthor',
      roomId: 'testroom',
      content: ['tag1', 'tag2']
    }

    await roomTagsServiceMock.create(payload)

    expect(dbMock.insert).toHaveBeenCalledWith('roomTags', {
      authorId: 'testauthor',
      roomId: 'testroom',
      content: '["tag1","tag2"]'
    })
  })

  it('should update a room tag', async () => {
    const payload = ['tag1', 'tag2']

    dbMock.get.mockResolvedValue([
      {
        id: 1,
        roomId: 'testroom',
        authorId: 'testauthor',
        content: '["tag1","tag2"]'
      }
    ])

    await roomTagsServiceMock.update('testauthor', 'testroom', payload)

    expect(dbMock.update).toHaveBeenCalledWith(
      'roomTags',
      {
        content: '["tag1","tag2"]'
      },
      'id',
      1
    )
  })

  it('should delete a room tag', async () => {
    dbMock.get.mockResolvedValue([
      {
        id: 1,
        roomId: 'testroom',
        authorId: 'testauthor',
        content: '["tag1","tag2"]'
      }
    ])

    await roomTagsServiceMock.delete('testauthor', 'testroom')

    expect(dbMock.deleteEqual).toHaveBeenCalledWith('roomTags', 'id', 1)
  })

  it('should return null if the room tag does not exist', async () => {
    dbMock.get.mockResolvedValue([])

    const result = await roomTagsServiceMock.get('testauthor', 'testroom')

    expect(result).toBeNull()
  })

  it('should throw an error if something wrong happens when fetching a tag', async () => {
    dbMock.get.mockRejectedValue(new Error('test error'))

    await expect(
      roomTagsServiceMock.get('testauthor', 'testroom')
    ).rejects.toThrowError('Failed to fetch room tags')
  })

  it('should throw an error if something wrong happens when creating a tag', async () => {
    dbMock.insert.mockRejectedValue(new Error('test error'))

    await expect(
      roomTagsServiceMock.create({
        authorId: 'testauthor',
        roomId: 'testroom',
        content: ['tag1', 'tag2']
      })
    ).rejects.toThrowError('Failed to create room tags')
  })

  it('should throw an error if something wrong happens when updating a tag', async () => {
    dbMock.insert.mockRejectedValue(new Error('test error'))

    await expect(
      roomTagsServiceMock.update('testauthor', 'testroom', ['tag1', 'tag2'])
    ).rejects.toThrowError('Failed to update room tags')
  })

  it('should throw an error if something wrong happens when deleting a tag', async () => {
    dbMock.deleteEqual.mockRejectedValue(new Error('test error'))

    await expect(
      roomTagsServiceMock.delete('testauthor', 'testroom')
    ).rejects.toThrowError('Failed to delete room tags')
  })
})
