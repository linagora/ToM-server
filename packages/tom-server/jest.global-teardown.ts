import fs from 'fs'
import path from 'path'

const logsDir = path.join(__dirname, 'logs')

export default (): void => {
  if (fs.existsSync(logsDir)) {
    fs.rmSync(logsDir, { recursive: true })
  }
}
