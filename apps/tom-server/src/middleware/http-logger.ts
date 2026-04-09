import type { NextFunction, Request, Response } from "express";
import type { Logger } from "winston";

import type { TomRequest } from "../types";

export function httpLogger(logger: Logger) {
  // Express callback contract: void return is framework-mandated
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = performance.now();
    const tomReq = req as TomRequest;

    const child = logger.child({
      requestId: tomReq.requestId,
      method: req.method,
      path: req.originalUrl,
    });

    tomReq.log = child;

    res.on("finish", () => {
      const duration = Math.round(performance.now() - start);

      child.http(`request completed`, {
        status: res.statusCode,
        durationMs: duration,
        contentLength: res.get("content-length"),
      });
    });

    next();
  };
}
