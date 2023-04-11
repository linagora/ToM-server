import { type SupportedDatabases } from './db'

export interface Config {
  database_engine: SupportedDatabases
  database_host: string
  server_name: string
}

export type expressAppHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void

export class VaultAPIError extends Error {
  statusCode: number

  constructor (message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}
