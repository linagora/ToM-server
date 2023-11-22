import { type TwakeLogger } from '@twake/logger'
import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response
} from 'express'

export default (logger: TwakeLogger): ErrorRequestHandler => {
  return (
    error: Error & { status?: number },
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const statusCode = error.status ?? 500
      const message = error.message ?? 'Something went wrong'

      logger.error(
        `[${req.method}] ${req.path} >> StatusCode:: ${statusCode}, Message:: ${message}`
      )

      res.status(statusCode).json({ message })
      return
    } catch (error) {
      next(error)
    }
  }
}
