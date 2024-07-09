import type { TwakeLogger } from '@twake/logger'
import type { TwakeDB } from '../../types'
import ActiveContactsService from '../services'

describe('The active contacts service', () => {
  const dbMock = {
    get: jest.fn(),
    insert: jest.fn(),
    deleteEqual: jest.fn()
  }

  const loggerMock = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }

  const activeContactsService = new ActiveContactsService(
    dbMock as unknown as TwakeDB,
    loggerMock as unknown as TwakeLogger
  )

  it('should save active contacts for a user', async () => {
    dbMock.insert.mockResolvedValue(undefined)

    await expect(
      activeContactsService.save('test', 'contact')
    ).resolves.not.toThrow()

    expect(dbMock.insert).toHaveBeenCalledWith('activeContacts', {
      userId: 'test',
      contacts: 'contact'
    })
  })

  it('should fetch active contacts for a user', async () => {
    dbMock.get.mockResolvedValue([{ userId: 'test', contacts: 'contact' }])

    await expect(activeContactsService.get('test')).resolves.toEqual('contact')

    expect(dbMock.get).toHaveBeenCalledWith('activeContacts', ['contacts'], {
      userId: 'test'
    })
  })

  it('should attempt to delete active contacts for a user', async () => {
    dbMock.deleteEqual.mockResolvedValue(undefined)

    await expect(activeContactsService.delete('test')).resolves.not.toThrow()

    expect(dbMock.deleteEqual).toHaveBeenCalledWith(
      'activeContacts',
      'userId',
      'test'
    )
  })

  it('should return null if no active contacts found for user', async () => {
    dbMock.get.mockResolvedValue([])

    await expect(activeContactsService.get('test')).resolves.toBeNull()
    expect(loggerMock.warn).toHaveBeenCalledWith('No active contacts found')
  })

  it('should log and throw an error if there is an error fetching active contacts', async () => {
    dbMock.get.mockRejectedValue(new Error('test'))

    await expect(activeContactsService.get('test')).rejects.toThrow()
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to get active contacts',
      expect.anything()
    )
  })

  it('should log and throw an error if something wrong happens while saving', async () => {
    dbMock.insert.mockRejectedValue(new Error('test'))

    await expect(
      activeContactsService.save('test', 'contact')
    ).rejects.toThrow()
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to save active contacts',
      expect.anything()
    )
  })

  it('should log and throw an error if something wrong happens while deleting', async () => {
    dbMock.deleteEqual.mockRejectedValue(new Error('test'))

    await expect(activeContactsService.delete('test')).rejects.toThrow()
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Failed to delete saved active contacts',
      expect.anything()
    )
  })
})
