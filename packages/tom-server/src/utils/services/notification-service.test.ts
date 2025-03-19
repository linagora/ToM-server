import { TwakeLogger } from '@twake/logger'
import { Config } from '../../types'
import NotificationService from './notification-service'

const sendSMSMock = jest.fn()
const sendEmailMock = jest.fn()

jest.mock('./sms-service.ts', () => {
  return function () {
    return {
      send: sendSMSMock
    }
  }
})

jest.mock('./email-service.ts', () => {
  return function () {
    return {
      from: 'no-reply@example.com',
      send: sendEmailMock
    }
  }
})

describe('the notification service', () => {
  const loggerMock = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
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

    it('should log an error if something wrong happens while sending an SMS', async () => {
      sendSMSMock.mockImplementationOnce(() => {
        throw new Error('Something went wrong')
      })

      await service.sendSMS('123456789', 'Hello World')

      expect(loggerMock.error).toHaveBeenCalledWith(
        'Failed to send SMS',
        expect.anything()
      )
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

    it('should log an error if something wrong happens while sending an email', async () => {
      sendEmailMock.mockImplementationOnce(() => {
        throw new Error('Something went wrong')
      })

      await service.sendEmail(options)

      expect(loggerMock.error).toHaveBeenCalledWith(
        'Failed to send email',
        expect.anything()
      )
    })
  })
})
