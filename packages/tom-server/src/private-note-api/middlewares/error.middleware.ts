import { type NextFunction, type Request, type Response } from 'express'

export default (
  error: Error & { status?: number },
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const statusCode = error.status ?? 500
    const message = error.message ?? 'Something went wrong'

    console.error(
      `[${req.method}] ${req.path} >> StatusCode:: ${statusCode}, Message:: ${message}`
    )

    res.status(statusCode).json({ message })
    return
  } catch (error) {
    next(error)
  }
}
