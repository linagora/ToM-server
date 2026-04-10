import type { Express } from "express";
import express from "express";
import type { Logger } from "winston";

import type { Config } from "./config/types";
import { errorMiddleware } from "./errors/error-middleware";
import { httpLogger } from "./middleware/http-logger";
import { requestId } from "./middleware/request-id";
import { createLandingRouter } from "./modules/landing/router";

export function createApp(config: Config, logger: Logger): Express {
  const app = express();

  // --- Global middleware (cross-cutting only) ---
  app.use(express.json());
  app.use(requestId());
  app.use(httpLogger(logger));

  // --- Module routers ---

  // --- Root Landing Page ---
  const landingRouter = createLandingRouter(config.landing, logger);
  if (landingRouter) {
    app.use(landingRouter);
  }

  // --- Error handler (single, terminal) ---
  app.use(errorMiddleware(config.i18n));

  return app;
}
