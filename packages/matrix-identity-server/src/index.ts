import type http from 'http'
import { Request, Response, NextFunction } from 'express'

type expressAppHandler = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  next?: NextFunction
) => void;

type IdServerAPI = {
  [url: string]: expressAppHandler
}

export default class MatrixServer {
  api: {
    get: IdServerAPI,
    post: IdServerAPI,
    put?: IdServerAPI,
  };

  constructor () {
    // TODO: insert here all endpoints
    this.api = {
      get: {
        '/': (req,res) => {
          this.send(res, 200, {"todo":"response"})
        }
      },
      post: {
        '/': (req,res) => {
          this.send(res, 200, {"todo":"response"})
        }
      },
    }
  }

  send(res: Response | http.ServerResponse, status: number, body: object): void {
    const content = JSON.stringify(body)
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': content.length,
    });
    res.write(content)
    res.end()
  }
}
