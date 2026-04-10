import { randomUUID } from "node:crypto";

import { trace } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";

import type { TomRequest } from "../types";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Injects a request ID into every request and enriches the active OTel span.
 *
 * Honors an incoming X-Request-Id from a reverse proxy (nginx, traefik)
 * if present; generates a UUIDv4 otherwise. The ID is:
 *   - Set on req.headers and res headers (transport layer)
 *   - Attached to (req as TomRequest).requestId (typed accessor)
 *   - Added as a span attribute on the active OTel span (trace correlation)
 *
 * Express callback contract: void return is framework-mandated.
 */
export function requestId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers[REQUEST_ID_HEADER];
    const id = typeof header === "string" ? header : randomUUID();

    req.headers[REQUEST_ID_HEADER] = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    (req as TomRequest).requestId = id;

    // Enrich the active span so traces carry the same ID as logs.
    // Auto-instrumentation already created the span — we just add an attribute.
    const activeSpan = trace.getActiveSpan();
    if (activeSpan !== undefined) {
      activeSpan.setAttribute("http.request_id", id);
    }

    next();
  };
}
