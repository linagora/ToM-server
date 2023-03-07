import type http from 'http'
import { type Request, type Response, type NextFunction } from 'express'

export type expressAppHandler = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  next?: NextFunction
) => void

export const send = (res: Response | http.ServerResponse, status: number, body: object): void => {
  const content = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': content.length
  })
  res.write(content)
  res.end()
}
