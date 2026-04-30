/**
 * CORS middleware factory.
 *
 * Configures Cross-Origin Resource Sharing headers based on application
 * configuration. Supports configurable origins, methods, headers, credentials,
 * and preflight caching.
 *
 * When cors.enabled is false, returns a no-op middleware.
 *
 * Express callback contract: void return is framework-mandated.
 */
import cors, { type CorsOptions } from "cors";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { Config } from "../config/types";

/**
 * Creates CORS middleware configured from application settings.
 *
 * @param corsConfig - CORS configuration from the application config
 * @returns Express middleware function handling CORS
 */
export function createCorsMiddleware(corsConfig: Config["cors"]): RequestHandler {
  if (!corsConfig.enabled) {
    return (_req: Request, _res: Response, next: NextFunction): void => {
      next();
    };
  }

  let allow_all = false;
  const exacts = new Set<string>();
  const regexes: RegExp[] = [];

  for (const rule of corsConfig.origins) {
    if (rule === "*") {
      allow_all = true;
      break;
    }

    if (rule.startsWith("~")) {
      regexes.push(new RegExp(rule.slice(1)));
    } else {
      exacts.add(rule);
    }
  }

  const options: CorsOptions = {
    // biome-ignore lint/nursery/useExplicitType: cors types does not export CustomOrigin type
    origin: (o, cb) => {
      if (allow_all) return cb(null, true);
      if (!o && corsConfig.allow_no_origin) return cb(null, true);
      if (o && (exacts.has(o) || regexes.some((rx) => rx.test(o)))) return cb(null, true);

      cb(new Error(`${o} blocked by server CORS policy`));
    },
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.allowed_headers,
    credentials: corsConfig.credentials,
    exposedHeaders: corsConfig.exposed_headers,
    maxAge: corsConfig.max_age,
  };

  return cors(options);
}
