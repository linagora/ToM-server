import { z } from "zod";

const DEFAULT_LOG_LEVEL = "info";
const DEFAULT_LOG_PRETTY = false;

// biome-ignore lint/nursery/useExplicitType: Zod type is fragile to write by hand, we let TS infer it
export const loggerConfigSchema = z.object({
  logger: z
    .object({
      level: z.enum(["error", "warn", "info", "http", "debug", "silly"]),
      pretty: z.boolean(),
    })
    .default({ level: DEFAULT_LOG_LEVEL, pretty: DEFAULT_LOG_PRETTY }),
});
