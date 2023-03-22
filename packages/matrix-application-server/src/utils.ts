import { type NextFunction, type Request, type Response } from 'express'

export type expressAppHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void
