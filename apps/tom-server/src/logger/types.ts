import type { z } from "zod";

import type { loggerSettingsSchema } from "./schema";

export type LoggerConfig = z.infer<typeof loggerSettingsSchema>;
