import type { z } from "zod";

import type { telemetryConfigSchema } from "./schema";

export type TelemetryConfig = z.infer<typeof telemetryConfigSchema>["telemetry"];
