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

const sendSMSMock = jest.fn()
const sendEmailMock = jest.fn()
const tokenAccessMock = jest.fn().mockResolvedValue('test')

jest.mock('../../utils/services/notification-service.ts', () => {
  return function () {
    return {
      sendSMS: sendSMSMock,
      sendEmail: sendEmailMock
    }
  }
})

jest.mock('../../utils/services/token-service.ts', () => {
  return function () {
    return {
      getAccessTokenWithCreds: tokenAccessMock
    }
  }
})

describe('the Invitation API service', () => {
  const invitationService = new Service(
    dbMock as unknown as TwakeDB,
    loggerMock as unknown as TwakeLogger,
    {
      matrix_server: 'localhost',
      base_url: 'http://localhost',
      signup_url: 'https://signup.example.com/?app=chat',
      template_dir: './templates',
      matrix_admin_login: 'login',
      matrix_admin_password: 'password'
    } as unknown as Config
  )

  describe('the list method', () => {
    it('should return the list of invitations', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recipient: 'test',
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
          recipient: 'test',
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
      sendSMSMock.mockResolvedValue(true)

      await invitationService.invite({
        recipient: 'test',
        medium: 'phone',
        sender: 'test'
      })

      expect(dbMock.insert).toHaveBeenCalledWith(
        'invitations',
        expect.any(Object)
      )
    })

    it('should send an SMS notification', async () => {
      sendSMSMock.mockResolvedValue(true)

      await invitationService.invite({
        recipient: 'test',
        medium: 'phone',
        sender: 'test'
      })

      expect(sendSMSMock).toHaveBeenCalledWith('test', expect.anything())
    })

    it('should throw an error if it fails to deliver the invitation', async () => {
      sendEmailMock.mockRejectedValue(new Error('test'))

      await expect(
        invitationService.invite({
          recipient: 'test',
          medium: 'email',
          sender: 'test'
        })
      ).rejects.toThrow('Failed to send invitation')
    })

    it('should throw an error if the database operation fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })

      dbMock.insert.mockRejectedValue(new Error('test'))

      await expect(
        invitationService.invite({
          recipient: 'test',
          medium: 'phone',
          sender: 'test'
        })
      ).rejects.toThrow('Failed to send invitation')
    })
  })

  describe('the accept method', () => {
    it('should update the invitation status', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recipient: 'test',
          medium: 'phone',
          expiration: `${Date.now() + 123456789}`,
          room_id: 'test',
          accessed: 0
        }
      ])

      await invitationService.accept('test', AUTHORIZATION)

      expect(dbMock.update).toHaveBeenCalledWith(
        'invitations',
        { accessed: 1 },
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
          recipient: 'test',
          medium: 'phone',
          expiration: `${Date.now() + 123456789}`,
          accessed: 0
        }
      ])

      await invitationService.accept('test', AUTHORIZATION)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://localhost/_matrix/client/v3/createRoom',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: AUTHORIZATION
          },
          body: JSON.stringify({
            is_direct: true,
            preset: 'private_chat',
            invite: ['test']
          })
        }
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
          recipient: 'test',
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
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })
      dbMock.insert.mockResolvedValue({ id: 'test' })

      const result = await invitationService.generateLink({
        sender: 'test',
        recipient: 'test',
        medium: 'phone'
      })

      expect(result.startsWith('https://signup.example.com/?app=chat')).toBe(
        true
      )
    })

    it('should throw an error if the database operation fails', async () => {
      dbMock.insert.mockRejectedValue(new Error('test'))

      await expect(
        invitationService.generateLink({
          sender: 'test',
          recipient: 'test',
          medium: 'phone'
        })
      ).rejects.toThrow('Failed to generate invitation link')
    })

    it('should insert the invitation into the database', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ room_id: 'test' })
      })
      dbMock.insert.mockResolvedValue({ id: 'test' })

      await invitationService.generateLink({
        sender: 'test',
        recipient: 'test',
        medium: 'phone'
      })

      expect(dbMock.insert).toHaveBeenCalledWith(
        'invitations',
        expect.any(Object)
      )
    })
  })

  describe('the getInvitationStatus method', () => {
    it('should return the invitation status', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'test',
          sender: 'test',
          recipient: 'test',
          medium: 'phone',
          expiration: `${Date.now() + 123456789}`,
          accessed: 0
        }
      ])

      const result = await invitationService.getInvitationStatus('test')

      expect(result).toEqual({
        id: 'test',
        sender: 'test',
        recipient: 'test',
        medium: 'phone',
        expiration: `${Date.now() + 123456789}`,
        accessed: false
      })
    })

    it('should throw an error if the database operation fails', async () => {
      dbMock.get.mockRejectedValue(new Error('test'))

      await expect(
        invitationService.getInvitationStatus('test')
      ).rejects.toThrow('Failed to get invitation')
    })
  })
})
