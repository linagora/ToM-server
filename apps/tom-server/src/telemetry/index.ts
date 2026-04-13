/**
 * @file OpenTelemetry SDK bootstrap.
 *
 * CRITICAL: This module must be loaded BEFORE express, pg, or any other
 * instrumented library. Auto-instrumentation works by monkey-patching
 * modules at require-time — if they're already loaded, the patches miss.
 *
 * Two ways to guarantee this:
 *   1. `node --import ./src/telemetry/index.js dist/server.js`
 *   2. Call `initTelemetry()` as the very first thing in `server.ts`,
 *      before any other import that pulls in express/pg transitively.
 *
 * This file uses dynamic imports for the SDK to avoid top-level side effects
 * when telemetry is disabled.
 */
import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type { Instrumentation, InstrumentationConfig } from "@opentelemetry/instrumentation";
import type { Resource } from "@opentelemetry/resources";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { type MetricReader, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import type { Logger } from "winston";

import type { TelemetryConfig } from "./types";

const DIAG_LEVELS: Record<string, DiagLogLevel> = {
  NONE: DiagLogLevel.NONE,
  ERROR: DiagLogLevel.ERROR,
  WARN: DiagLogLevel.WARN,
  INFO: DiagLogLevel.INFO,
  DEBUG: DiagLogLevel.DEBUG,
};

let sdk: NodeSDK | undefined;
let prometheusExporter: PrometheusExporter | undefined;

/**
 * Initializes the OpenTelemetry SDK.
 *
 * Returns the PrometheusExporter instance so the Express app can mount
 * the /metrics endpoint. Returns undefined if telemetry is disabled.
 */
function setupDiagnosticLogger(level: string, logger: Logger): void {
  if (level === "NONE") return;

  logger.info(`Setting OTel diagnostic log level to ${level}`);
  diag.setLogger(new DiagConsoleLogger(), DIAG_LEVELS[level]);
}

function createTelemetryResource(): Resource {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "tom",
    [ATTR_SERVICE_VERSION]: "0.0.0",
  });
}

function createPrometheusExporter(logger: Logger): PrometheusExporter {
  return new PrometheusExporter({ preventServerStart: true }, (error) => {
    if (error) logger.error("Failed to start Prometheus exporter", error);
  });
}

function createOtlpMetricReader(endpoint: string): PeriodicExportingMetricReader {
  return new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
    exportIntervalMillis: 15_000,
  });
}

function createSpanProcessors(endpoint?: string): BatchSpanProcessor[] {
  return endpoint ? [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }))] : [];
}

function getInstrumentations(): Instrumentation<InstrumentationConfig>[][] {
  return [
    getNodeAutoInstrumentations({
      // Disable fs instrumentation — too noisy, no value for an API server
      "@opentelemetry/instrumentation-fs": { enabled: false },
      // Disable dns — adds latency tracking noise
      "@opentelemetry/instrumentation-dns": { enabled: false },
    }),
  ];
}

export function initTelemetry(config: TelemetryConfig, logger: Logger): PrometheusExporter | undefined {
  if (!config.enabled) {
    logger.info("Telemetry is disabled");
    return undefined;
  }

  setupDiagnosticLogger(config.diag_log_level, logger);

  prometheusExporter = createPrometheusExporter(logger);

  const metricReaders: MetricReader[] = [prometheusExporter];
  if (config.otlp_endpoint) {
    logger.info(`OTLP endpoint configured: ${config.otlp_endpoint}`);
    metricReaders.push(createOtlpMetricReader(config.otlp_endpoint));
  }

  sdk = new NodeSDK({
    resource: createTelemetryResource(),
    metricReaders: metricReaders,
    spanProcessors: createSpanProcessors(config.otlp_endpoint),
    instrumentations: getInstrumentations(),
  });

  if (!sdk) {
    logger.error("Failed to create NodeSDK");
    return undefined;
  }

  // Register additional metric readers beyond the first
  // (NodeSDK only accepts one via constructor; extras are added to the provider)
  sdk.start();

  return prometheusExporter;
}

/**
 * Graceful shutdown — flushes pending spans and metrics.
 * Call in process signal handlers.
 */
export async function shutdownTelemetry(logger: Logger): Promise<void> {
  if (sdk) {
    logger.info("Shutting down telemetry...");

    try {
      await sdk.shutdown();
    } catch (e) {
      logger.error("Error shutting down telemetry", e);
    }

    logger.info("Telemetry shutdown completed, unsetting NodeSDK");
    sdk = undefined;
  }
}

export { prometheusExporter };
