import type { z } from "zod";

import type { telemetrySettingsSchema } from "./schema";

export type TelemetryConfig = z.infer<typeof telemetrySettingsSchema>;
