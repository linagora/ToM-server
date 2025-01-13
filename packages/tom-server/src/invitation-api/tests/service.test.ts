import { type TwakeLogger } from '@twake/logger'
import Service from '../services'
import { Config, TwakeDB } from '../../types'

const dbMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}

const AUTHORIZATION = 'Bearer test'

beforeEach(() => {
  jest.resetAllMocks()
})

describe('the Invitation API service', () => {
  const invitationService = new Service(
    dbMock as unknown as TwakeDB,
    loggerMock as unknown as TwakeLogger,
    {
      matrix_server: 'localhost',
      base_url: 'http://localhost'
    } as unknown as Config
  )

  describe('the list method', () => {
    it('should return the list of invitations', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recepient: 'test',
          medium: 'test',
          expiration: '123456789',
          accessed: 0
        }
      ])

      const result = await invitationService.list('test')

      expect(result).toEqual([
        {
          id: 'test',
          sender: 'test',
          recepient: 'test',
          medium: 'test',
          expiration: '123456789',
          accessed: false
        }
      ])
    })

    it('should throw an error if the database operation fails', async () => {
      dbMock.get.mockRejectedValue(new Error('test'))

      await expect(invitationService.list('test')).rejects.toThrow(
        'Failed to list invitations'
      )
    })

    it('should return an empty array if no invitations are found', async () => {
      dbMock.get.mockResolvedValue([])

      const result = await invitationService.list('test')

      expect(result).toEqual([])
    })
  })

  describe('the invite method', () => {
    it('should send an invitation and insert it into the database', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })

      await invitationService.invite(
        { recepient: 'test', medium: 'phone', sender: 'test' },
        'Bearer test'
      )

      expect(dbMock.insert).toHaveBeenCalledWith(
        'invitations',
        expect.any(Object)
      )
    })

    it('should throw an error if the fetch operation fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('test'))

      await expect(
        invitationService.invite(
          { recepient: 'test', medium: 'phone', sender: 'test' },
          'Bearer test'
        )
      ).rejects.toThrow('Failed to send invitation')
    })

    it('should throw an error if the database operation fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })

      dbMock.insert.mockRejectedValue(new Error('test'))

      await expect(
        invitationService.invite(
          { recepient: 'test', medium: 'phone', sender: 'test' },
          'Bearer test'
        )
      ).rejects.toThrow('Failed to send invitation')
    })
  })

  describe('the accept method', () => {
    it('should accept an invitation', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recepient: 'test',
          medium: 'phone',
          expiration: `${Date.now() + 123456789}`,
          room_id: 'test',
          accessed: 0
        }
      ])

      await invitationService.accept('test', AUTHORIZATION)

      expect(dbMock.update).toHaveBeenCalledWith(
        'invitations',
        { accessed: 1, room_id: 'test' },
        'id',
        'test'
      )
    })

    it('should create a room if the invitation does not have one', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })

      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recepient: 'test',
          medium: 'phone',
          expiration: `${Date.now() + 123456789}`,
          accessed: 0
        }
      ])

      await invitationService.accept('test', AUTHORIZATION)

      expect(dbMock.update).toHaveBeenCalledWith(
        'invitations',
        { accessed: 1, room_id: 'test' },
        'id',
        'test'
      )
    })

    it('should throw an error if the invitation is not found', async () => {
      dbMock.get.mockResolvedValue([])

      await expect(
        invitationService.accept('test', AUTHORIZATION)
      ).rejects.toThrow('Failed to accept invitation')
    })

    it('should throw an error if the database operation fails', async () => {
      dbMock.get.mockRejectedValue(new Error('test'))

      await expect(
        invitationService.accept('test', AUTHORIZATION)
      ).rejects.toThrow('Failed to accept invitation')
    })

    it('should throw an error if the invitation is expired', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recepient: 'test',
          medium: 'phone',
          expiration: `${Date.now() - 123456789}`,
          accessed: 0
        }
      ])

      await expect(
        invitationService.accept('test', AUTHORIZATION)
      ).rejects.toThrow('Failed to accept invitation')
    })
  })

  describe('the generateLink method', () => {
    it('should generate an invitation link', async () => {
      dbMock.insert.mockResolvedValue({ id: 'test' })

      const result = await invitationService.generateLink({
        sender: 'test',
        recepient: 'test',
        medium: 'phone'
      })

      expect(result.startsWith('http://localhost/_twake/v1/invite/')).toBe(true)
    })

    it('should throw an error if the database operation fails', async () => {
      dbMock.insert.mockRejectedValue(new Error('test'))

      await expect(
        invitationService.generateLink({
          sender: 'test',
          recepient: 'test',
          medium: 'phone'
        })
      ).rejects.toThrow('Failed to generate invitation link')
    })

    it('should insert the invitation into the database', async () => {
      dbMock.insert.mockResolvedValue({ id: 'test' })

      await invitationService.generateLink({
        sender: 'test',
        recepient: 'test',
        medium: 'phone'
      })

      expect(dbMock.insert).toHaveBeenCalledWith(
        'invitations',
        expect.any(Object)
      )
    })
  })
})
