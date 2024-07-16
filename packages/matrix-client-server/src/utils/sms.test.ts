import fs from 'fs/promises'
import path from 'path'
import SmsSender from '../utils/smsSender'
import defaultConfig from '../config.json'
import { type Config } from '../types'

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  mkdir: jest.fn()
}))

describe('SmsSender', () => {
  // @ts-expect-error : TS doesn't know that the Config object is valid
  const conf: Config = {
    ...defaultConfig,
    database_engine: 'sqlite',
    base_url: 'http://example.com/',
    userdb_engine: 'sqlite',
    matrix_database_engine: 'sqlite'
  }
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should write SMS content to the correct file', async () => {
    const sender = new SmsSender(conf)
    const smsData = { to: '1234567890', raw: 'Test SMS content' }
    const fileName = `sms_${smsData.to}_${Date.now()}.txt`
    const filePath = path.join(conf.sms_folder, fileName)

    await sender.sendSMS(smsData)
    expect(fs.writeFile).toHaveBeenCalledWith(filePath, smsData.raw, 'utf8')
    expect(fs.mkdir).toHaveBeenCalledWith(conf.sms_folder, { recursive: true })
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      smsData.raw,
      'utf8'
    )
  })

  it('should throw an error if SMS folder is not specified in the config', () => {
    // @ts-expect-error : Not a Config object
    expect(() => new SmsSender({})).toThrow(
      'SMS folder path not specified in the configuration'
    )
  })

  it('should log a message when SMS content is written successfully', async () => {
    console.log = jest.fn()
    const sender = new SmsSender(conf)
    const smsData = { to: '1234567890', raw: 'Test SMS content' }

    await sender.sendSMS(smsData)

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('SMS content written to')
    )
  })

  it('should log an error message if writing SMS content to file fails', async () => {
    console.error = jest.fn()
    ;(fs.writeFile as jest.Mock).mockRejectedValueOnce(
      new Error('Failed to write file')
    )
    const sender = new SmsSender(conf)
    const smsData = { to: '1234567890', raw: 'Test SMS content' }

    await expect(sender.sendSMS(smsData)).rejects.toThrow(
      'Failed to write file'
    )
    expect(console.error).toHaveBeenCalledWith(
      'Failed to write SMS content to file',
      expect.any(Error)
    )
  })
})
