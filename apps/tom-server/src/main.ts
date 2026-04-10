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

import { resolve } from "node:path";

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
loadMessages(resolve(config.i18n.localesPath), logger.child({ module: "i18n" }));

// Boot telemetry before anything that imports express/pg
const prometheusExporter: PrometheusExporter | undefined = initTelemetry(
  config.telemetry,
  logger.child({ module: "telemetry" }),
);

const app: Express = createApp(config, logger, prometheusExporter);

app.listen(config.port, config.host, () => {
  logger.info(`tom listening on ${config.host}:${config.port}`);
});

// Graceful shutdown — flush pending spans and metrics
process.on("SIGTERM", async () => {
  await shutdownTelemetry(logger.child({ module: "telemetry" }));
  process.exit(0);
});
