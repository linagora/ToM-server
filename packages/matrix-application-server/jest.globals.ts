import fs from 'fs'

export const JEST_PROCESS_ROOT_PATH = __dirname

export const removeLogFile = async (logFilePath: string): Promise<void> => {
  let timer: NodeJS.Timeout | null = null
  await new Promise<void>((resolve, reject) => {
    timer = setInterval(() => {
      try {
        if (fs.existsSync(logFilePath)) {
          fs.unlinkSync(logFilePath)
          resolve()
        }
      } catch (e) {
        reject(e)
      }
    }, 1000)
  })
  if (timer != null) clearInterval(timer)
}
