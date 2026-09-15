import { beforeEach, describe, expect, it, mock, test } from 'bun:test'
import { TwakeLogger } from '../../../logger'
import { Config } from '../../types'
import NotificationService from './notification-service'

const sendSMSMock = mock()
const sendEmailMock = mock()

mock.module('./sms-service.ts', () => {
  return {
    default: function () {
      return {
        send: sendSMSMock
      }
    }
  }
})

mock.module('./email-service.ts', () => {
  return {
    default: function () {
      return {
        from: 'no-reply@example.com',
        send: sendEmailMock
      }
    }
  }
})

describe('the notification service', () => {
  const loggerMock = {
    info: mock(),
    error: mock(),
    warn: mock()
  }

  const configMock = {
    matrix_server: 'example.com'
  } as unknown as Config

  const service = new NotificationService(
    configMock,
    loggerMock as unknown as TwakeLogger
  )

  describe('the sendSMS method', () => {
    it('should attempt to send an SMS', async () => {
      await service.sendSMS('123456789', 'Hello World')

      expect(sendSMSMock).toHaveBeenCalledWith('123456789', 'Hello World')
    })

    it('should throw an error if something wrong happens while sending an SMS', async () => {
      sendSMSMock.mockImplementationOnce(() => {
        throw new Error('Something went wrong')
      })

      await expect(
        service.sendSMS('123456789', 'Hello World')
      ).rejects.toThrow()
    })
  })

  describe('the sendEmail method', () => {
    const options = {
      from: 'test@example.com',
      to: 'test@example.com',
      subject: 'Hello World',
      text: 'Hello World'
    }

    beforeEach(() => {
      sendEmailMock.mockClear()
    })

    it('should attempt to send an email', async () => {
      await service.sendEmail(options)

      expect(sendEmailMock).toHaveBeenCalledWith(options)
    })

    it('should throw an error if something wrong happens while sending an email', async () => {
      sendEmailMock.mockImplementationOnce(() => {
        throw new Error('Something went wrong')
      })

      await expect(service.sendEmail(options)).rejects.toThrow()
    })
  })
})
