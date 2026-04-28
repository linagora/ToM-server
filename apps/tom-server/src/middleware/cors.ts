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
import cors from "cors";
import type { NextFunction, Request, Response } from "express";

import type { Config } from "../config/types";

type CorsOptions = {
  origin: string[] | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods: string;
  allowedHeaders: string[];
  exposedHeaders?: string[];
  credentials: boolean;
  maxAge?: number;
  optionsSuccessStatus: number;
};

/**
 * Creates CORS middleware configured from application settings.
 *
 * @param corsConfig - CORS configuration from the application config
 * @returns Express middleware function handling CORS
 */
// biome-ignore lint/nursery/useExplicitType: Unclear Express middleware type returned by cors...
export function createCorsMiddleware(corsConfig: Config["cors"]) {
  // If CORS is disabled, return no-op middleware
  if (!corsConfig.enabled) {
    return (_req: Request, _res: Response, next: NextFunction): void => {
      next();
    };
  }

  const options: CorsOptions = {
    origin: corsConfig.origins,
    methods: corsConfig.methods.join(","),
    allowedHeaders: corsConfig.allowed_headers,
    credentials: corsConfig.credentials,
    optionsSuccessStatus: 204,
  };

  // Add optional exposed headers if configured
  if (corsConfig.exposed_headers !== undefined && corsConfig.exposed_headers.length > 0) {
    options.exposedHeaders = corsConfig.exposed_headers;
  }

  // Add optional max age if configured
  if (corsConfig.max_age !== undefined) {
    options.maxAge = corsConfig.max_age;
  }

  return cors(options);
}
