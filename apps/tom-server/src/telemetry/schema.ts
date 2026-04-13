import { z } from "zod";

const TELEMETRY_ENABLED_DEFAULT = true;
const TELEMETRY_METRICS_ENDPOINT = "/metrics";
const TELEMETRY_SAMPLING_RATIO_DEFAULT = 1.0;
const TELEMETRY_DIAGNOSTICS_LOG_LEVEL_DEFAULT = "NONE";

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
export const telemetrySettingsSchema = z.object({
  enabled: z.boolean().default(TELEMETRY_ENABLED_DEFAULT),
  // Prometheus scrape endpoint path
  metrics_endpoint: z.string().default(TELEMETRY_METRICS_ENDPOINT),
  // OTLP exporter endpoint for push-based collection (traces + metrics)
  // Fix: using z.url() since z.url() is not a standalone primitive in zod
  otlp_endpoint: z.url().optional(),
  // Trace sampling ratio: 1.0 = sample everything, 0.1 = 10%
  trace_sample_ratio: z.number().min(0).max(1).default(TELEMETRY_SAMPLING_RATIO_DEFAULT),
  // Diagnostic log level for OTel internals (troubleshooting only)
  diag_log_level: z.enum(["NONE", "ERROR", "WARN", "INFO", "DEBUG"]).default(TELEMETRY_DIAGNOSTICS_LOG_LEVEL_DEFAULT),
});
