import { Router } from "express";
import type { Logger } from "winston";

import { DomainError } from "../../errors/domain-error";
import { NOT_FOUND } from "../../errors/error-codes";
import { wellKnownClientController } from "./controller";
import { WellKnownClientService } from "./service";
import type { WellKnownClientSettings } from "./types";

export const createWellKnownClientRouter = (config: WellKnownClientSettings, logger: Logger): Router => {
  const router = Router();
  const service = new WellKnownClientService(config, logger);

  router.get("/.well-known/matrix/client", (_req, res, next) => {
    try {
      if (!config.enabled) {
        const msg = "well-known matrix client route disabled";
        logger.info(msg);

        throw new DomainError(NOT_FOUND, msg, {
          route: "/.well-known/matrix/client",
        });
      }

      const document = wellKnownClientController(service);

      if (Object.keys(document).length === 0) {
        const msg = "well-known matrix client document is empty";
        logger.info(msg);

        throw new DomainError(NOT_FOUND, msg, {
          route: "/.well-known/matrix/client",
        });
      }

      res.json(document);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
