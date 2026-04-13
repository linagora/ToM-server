import { z } from "zod";

const DEFAULT_LOG_LEVEL = "info";
const DEFAULT_LOG_PRETTY = false;

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
export const loggerSettingsSchema = z.object({
  level: z.enum(["error", "warn", "info", "http", "debug", "silly"]).default(DEFAULT_LOG_LEVEL),
  pretty: z.boolean().default(DEFAULT_LOG_PRETTY),
});
