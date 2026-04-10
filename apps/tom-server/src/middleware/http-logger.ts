/**
 * HTTP request/response structured logging middleware.
 *
 * Creates a child logger scoped to the current request and attaches it
 * to `req.log` for use in routers and downstream middleware.
 *
 * Injects `traceId` and `spanId` from the active OTel span into every
 * log line. This enables Grafana Loki → Tempo "jump to trace" linking:
 * a log line carries the trace ID, Grafana correlates it to the span.
 *
 * Request duration and status code metrics are handled by OTel
 * auto-instrumentation (http.server.duration). This middleware only
 * handles structured log output.
 *
 * Express callback contract: void return is framework-mandated.
 */
import { trace } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";
import type { Logger } from "winston";

import type { TomRequest } from "../types";

/**
 * Extracts traceId and spanId from the active OTel context.
 * Returns empty strings if no active span (e.g., telemetry disabled).
 */
function getTraceContext(): { traceId: string; spanId: string } {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan === undefined) {
    return { traceId: "", spanId: "" };
  }
  const ctx = activeSpan.spanContext();
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}

export function httpLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = performance.now();
    const tomReq = req as TomRequest;
    const { traceId, spanId } = getTraceContext();

    const child = logger.child({
      requestId: tomReq.requestId,
      traceId,
      spanId,
      method: req.method,
      path: req.originalUrl,
    });

    // Attach child logger to request for use in routers and services
    tomReq.log = child;

    res.on("finish", () => {
      const duration = Math.round(performance.now() - start);

      child.info("request completed", {
        status: res.statusCode,
        durationMs: duration,
        contentLength: res.get("content-length"),
      });
    });

    next();
  };
}
