import { Router } from "express";
import type { Logger } from "winston";

import { landingController } from "./controller";
import { LandingService } from "./service";
import type { LandingConfig } from "./types";

export const createLandingRouter = (config: LandingConfig, logger: Logger): Router | null => {
  const service = new LandingService(config, logger);

  if (!service.available) {
    return null;
  }

  const router = Router();

  router.get("/", (_req, res, next) => {
    try {
      const { filePath } = landingController(service);
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
