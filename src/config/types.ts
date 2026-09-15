import type { z } from "zod";

import type { configSchema } from "./schema";

export type Config = z.infer<typeof configSchema>;
