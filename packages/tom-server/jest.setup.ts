import fs from 'fs'
import path from 'path'

const registrationFilePath = path.join(__dirname, 'registration.yaml')

jest.mock('node-fetch', () => jest.fn())
afterAll(() => {
  if (fs.existsSync(registrationFilePath)) {
    fs.unlinkSync(registrationFilePath)
  }
})
