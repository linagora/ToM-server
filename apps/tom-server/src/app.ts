import type { Express } from "express";
import express from "express";
import type { Logger } from "winston";

import type { Config } from "./config/types";
import { httpLogger } from "./middleware/http-logger";
import { requestId } from "./middleware/request-id";

export function createApp(config: Config, logger: Logger): Express {
  const app = express();

  // --- Global middleware (cross-cutting only) ---
  app.use(express.json());
  app.use(requestId());
  app.use(httpLogger(logger));

  return app;
}
