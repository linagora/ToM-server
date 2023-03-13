import type http from 'http'
import { type Request, type Response, type NextFunction } from 'express'
import { errMsg } from './utils/errors'
import { type tokenContent } from './account/register'
import type IdentityServerDb from './db'

export type expressAppHandler = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  next?: NextFunction
) => void

export const send = (res: Response | http.ServerResponse, status: number, body: string | object): void => {
  const content =
  /* istanbul ignore next */
   typeof body === 'string'
     ? body
     : JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': content.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  })
  res.write(content)
  res.end()
}

type authorizationFunction = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  callback: (data: tokenContent, id?: string) => void) => void

export const Authenticate = (db: IdentityServerDb): authorizationFunction => {
  const tokenRe = /^Bearer ([a-zA-Z0-9]{64})$/
  const sub: authorizationFunction = (req, res, callback) => {
    if (req.headers.authorization != null) {
      const re = req.headers.authorization.match(tokenRe)
      if (re != null) {
        db.get('tokens', 'id', re[1]).then((rows) => {
          callback(JSON.parse(rows[0].data as string), re[1])
        }).catch(e => {
          send(res, 401, errMsg('unAuthorized'))
        })
      } else {
        send(res, 401, errMsg('unAuthorized'))
      }
    } else {
      send(res, 401, errMsg('unAuthorized'))
    }
  }
  return sub
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

export const epoch = (): number => {
  return Math.floor(Date.now() / 1000)
}
