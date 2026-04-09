import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import type { TomRequest } from "../types";

const REQUEST_ID_HEADER = "x-request-id";

export function requestId() {
  // Express callback contract: void return is framework-mandated
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers[REQUEST_ID_HEADER];
    const id = typeof header === "string" ? header : randomUUID();

    req.headers[REQUEST_ID_HEADER] = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    (req as TomRequest).requestId = id;

    next();
  };
}
