/**
 * @file Composition root. Boots config, telemetry, db, and starts listening.
 *
 * CRITICAL: initTelemetry() must be called before any import that
 * transitively loads express or pg. Auto-instrumentation patches modules
 * at require-time — if they're already in the module cache, the patches
 * miss and you get no trace/metric data.
 */

// --- Telemetry must initialize FIRST ---
import { initTelemetry, shutdownTelemetry } from "./telemetry/index";

import type { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import type { Express } from "express";
import type { Logger } from "winston";

import { createApp } from "./app";
import { loadConfig } from "./config/index";
import type { Config } from "./config/types";
import { loadMessages } from "./i18n/index";
import { createLogger } from "./logger/index";

const configPath: string | undefined = process.argv.includes("--config")
  ? process.argv[process.argv.indexOf("--config") + 1]
  : undefined;

const config: Config = loadConfig(configPath);
const logger: Logger = createLogger(config.logger);
loadMessages(config.i18n.locales_path, logger.child({ module: "i18n" }));

// Boot telemetry before anything that imports express/pg
const prometheusExporter: PrometheusExporter | undefined = initTelemetry(
  config.telemetry,
  logger.child({ module: "telemetry" }),
);

// Initialize app asynchronously and start server
(async () => {
  const app: Express = await createApp(config, logger, prometheusExporter);

  app.listen(config.server.port, config.server.host, () => {
    logger.info(`tom listening on ${config.server.host}:${config.server.port}`);
  });
})().catch((err) => {
  logger.error("Failed to start application:", err);
  process.exit(1);
});

// Graceful shutdown — flush pending spans and metrics
process.on("SIGTERM", async () => {
  await shutdownTelemetry(logger.child({ module: "telemetry" }));
  process.exit(0);
});
