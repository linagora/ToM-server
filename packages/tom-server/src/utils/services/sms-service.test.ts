import { TwakeLogger } from '@twake/logger'
import type { Config } from '../../types'
import SmsService from './sms-service'

const loggerMock = {
  info: jest.fn(),
  error: jest.fn()
}

const mockConfig = {
  sms_api_key: 'test_key',
  sms_api_login: 'test_secret',
  sms_api_url: 'http://localhost/sms/api'
}

describe('the SMS service', () => {
  const smsService = new SmsService(
    mockConfig as Config,
    loggerMock as unknown as TwakeLogger
  )

  describe('the send method', () => {
    it('should send a SMS', async () => {
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true }),
          status: 200
        })
      })

      await smsService.send('test', 'test')
      expect(loggerMock.error).not.toHaveBeenCalled()
    })

    it('should log an error when failed to send SMS', async () => {
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          json: () => Promise.resolve({}),
          status: 401
        })
      })

      await smsService.send('test', 'test')

      expect(loggerMock.error).toHaveBeenCalledWith(
        'Failed to send SMS',
        expect.anything()
      )
    })

    it('should call the API endpoint with correct parameters', async () => {
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true }),
          status: 200
        })
      })

      await smsService.send('+330744556688', 'test sms')

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/sms/api/sms-campaign/send',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-login': 'test_secret',
            'api-key': 'test_key'
          },
          body: JSON.stringify({
            sender: 'Twake',
            recipients: [{ phone_number: '+330744556688' }],
            text: 'test sms'
          })
        }
      )
    })
  })
})
