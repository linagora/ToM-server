import type http from 'http'
import { type Request, type Response, type NextFunction } from 'express'
import { errMsg } from './utils/errors'

export type expressAppHandler = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  next?: NextFunction
) => void

export const send = (res: Response | http.ServerResponse, status: number, body: string | object): void => {
  const content =
   typeof body === 'string'
     ? body
     : JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': content.length
  })
  res.write(content)
  res.end()
}

export const jsonContent = (req: Request | http.IncomingMessage, res: Response | http.ServerResponse, callback: (obj: Record<string, string>) => void): void => {
  let content = ''
  let accept = true
  req.on('data', (body: string) => {
    content += body
  })
  /* istanbul ignore next */
  req.on('error', (err) => {
    send(res, 400, errMsg('unknown', err.message))
    accept = false
  })
  req.on('end', () => {
    let obj
    try {
      obj = JSON.parse(content)
    } catch (err) {
      console.error('JSON error', err)
      send(res, 400, errMsg('unknown', err as string))
      accept = false
    }
    if (accept) callback(obj)
  })
}

type validateParametersSchema = Record<string, boolean>

type validateParametersType = (
  res: Response | http.ServerResponse,
  desc: validateParametersSchema,
  content: Record<string, string>,
  callback: (obj: object) => void
) => void

export const validateParameters: validateParametersType = (res, desc, content, callback) => {
  const missingParameters: string[] = []
  const additionalParameters: string[] = []
  // Check for required parameters
  Object.keys(desc).forEach((key) => {
    if (desc[key] && content[key] == null) {
      missingParameters.push(key)
    }
  })
  if (missingParameters.length > 0) {
    send(res, 400, errMsg('missingParams', `Missing parameters ${missingParameters.join(', ')}`))
  } else {
    Object.keys(content).forEach((key) => {
      if (desc[key] == null) {
        additionalParameters.push(key)
      }
    })
    if (additionalParameters.length > 0) {
      // TODO: for now, accept additional params
      console.warn('Additional parameters', additionalParameters)
    }
    callback(content)
  }
}
