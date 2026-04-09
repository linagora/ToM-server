import type { z } from "zod";

import type { loggerConfigSchema } from "./schema";

export type LoggerConfig = z.infer<typeof loggerConfigSchema>["logger"];
