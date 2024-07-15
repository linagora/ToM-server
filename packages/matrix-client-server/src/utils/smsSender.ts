import fs from 'fs/promises'
import path from 'path'
import { type Config } from '../types'

class SmsSender {
  private readonly folderPath: string

  constructor(conf: Config) {
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (!conf.sms_folder) {
      throw new Error('SMS folder path not specified in the configuration')
    }
    this.folderPath = conf.sms_folder
  }

  async sendSMS(obj: { to: string; raw: string }): Promise<void> {
    const { to, raw } = obj
    const fileName = `sms_${to}_${Date.now()}.txt`
    const filePath = path.join(this.folderPath, fileName)

    try {
      await fs.mkdir(this.folderPath, { recursive: true })
      await fs.writeFile(filePath, raw, 'utf8')
      console.log(`SMS content written to ${filePath}`)
    } catch (error) {
      console.error('Failed to write SMS content to file', error)
      throw error
    }
  }
}

export default SmsSender
