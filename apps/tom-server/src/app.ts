/**
 * @file Express app factory.
 *
 * Mounts global middleware, telemetry endpoints, OpenAPI, module routers,
 * and the terminal error handler. Returns the app instance — never starts
 * listening. That is server.ts's job.
 */
import type { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import type { Express } from "express";
import express from "express";
import type { Logger } from "winston";

import type { Config } from "./config/types";
import { errorMiddleware } from "./errors/error-middleware";
import { createCorsMiddleware } from "./middleware/cors";
import { httpLogger } from "./middleware/http-logger";
import { requestId } from "./middleware/request-id";
import { createLandingRouter } from "./modules/landing/router";
import { createLegacyRouter } from "./modules/legacy/router";

export async function createApp(
  config: Config,
  logger: Logger,
  prometheusExporter: PrometheusExporter | undefined,
): Promise<Express> {
  const app = express();

  if (config.server.trust_x_forwarded_for) {
    const hops = config.server.trusted_proxies;
    app.set("trust proxy", hops.length > 0 ? hops : true);
  }

  // --- Global middleware (cross-cutting only) ---
  app.use(createCorsMiddleware(config.cors));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestId());
  app.use(httpLogger(logger));

  // --- Telemetry: Prometheus metrics endpoint ---
  // PrometheusExporter provides its own Express-compatible handler.
  // Undefined when telemetry is disabled (e.g., in tests).
  if (prometheusExporter) {
    logger.info(`Mounting Prometheus metrics endpoint at ${config.telemetry.metrics_endpoint}`);
    app.get(config.telemetry.metrics_endpoint, prometheusExporter.getMetricsRequestHandler.bind(prometheusExporter));
  }

  // --- Module routers ---
  const legacyRouter = await createLegacyRouter(config, logger);
  app.use(legacyRouter);

  // --- Root Landing Page ---
  const landingRouter = createLandingRouter(config.landing, logger);
  if (landingRouter) {
    logger.info("Mounting landing page router");
    app.use(landingRouter);
  }

  // --- Error handler (single, terminal) ---
  app.use(errorMiddleware(config.i18n));

  return app;
}
