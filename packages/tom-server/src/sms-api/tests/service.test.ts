import fetch, { type Response } from 'node-fetch'
import SmsService from '../services'
import { type Config } from '../../types'
import { getLogger } from '@twake/logger'
jest.mock('node-fetch')

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('the SMS service', () => {
  const smsConfig = {
    sms_api_key: 'test',
    sms_api_login: 'test',
    sms_api_url: 'http://url/'
  }
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>
  const logger = getLogger()
  const smsService = new SmsService(smsConfig as Config, logger)

  it('should attempt to use the SMS api', async () => {
    mockFetch.mockResolvedValue(
      Promise.resolve({ status: 200 } as unknown as Response)
    )
    await smsService.send({ to: ['123456'], text: 'test' })

    expect(mockFetch).toHaveBeenCalledWith('http://url/', {
      method: 'POST',
      body: JSON.stringify({
        recipients: [{ phone_number: '123456' }],
        sender: 'Twake',
        text: 'test',
        type: 'sms_low_cost'
      }),
      headers: {
        'Content-Type': 'application/json',
        'cache-control': 'no-cache',
        'api-key': 'test',
        'api-login': 'test'
      }
    })
  })

  it('should throw an error if the sms api returns an error', async () => {
    mockFetch.mockResolvedValue(
      Promise.resolve({ status: 400 } as unknown as Response)
    )
    // expect the service to throw an error
    await expect(
      smsService.send({ to: ['123456'], text: 'test' })
    ).rejects.toThrow('Failed to send SMS')
  })
})
