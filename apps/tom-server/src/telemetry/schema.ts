import { z } from "zod";

const TELEMETRY_ENABLED_DEFAULT = true;
const TELEMETRY_METRICS_ENDPOINT = "/metrics";
const TELEMETRY_SAMPLING_RATIO_DEFAULT = 1.0;
const TELEMETRY_DIAGNOSTICS_LOG_LEVEL_DEFAULT = "NONE";

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
export const telemetryConfigSchema = z.object({
  telemetry: z
    .object({
      enabled: z.boolean(),
      // Prometheus scrape endpoint path
      metricsEndpoint: z.string(),
      // OTLP exporter endpoint for push-based collection (traces + metrics)
      // When unset, metrics are Prometheus-pull only and traces go to console (dev)
      otlpEndpoint: z.url().optional(),
      // Trace sampling ratio: 1.0 = sample everything, 0.1 = 10%
      traceSampleRatio: z.number().min(0).max(1),
      // Diagnostic log level for OTel internals (troubleshooting only)
      diagLogLevel: z.enum(["NONE", "ERROR", "WARN", "INFO", "DEBUG"]),
    })
    .default({
      enabled: TELEMETRY_ENABLED_DEFAULT,
      metricsEndpoint: TELEMETRY_METRICS_ENDPOINT,
      traceSampleRatio: TELEMETRY_SAMPLING_RATIO_DEFAULT,
      diagLogLevel: TELEMETRY_DIAGNOSTICS_LOG_LEVEL_DEFAULT,
    }),
});
