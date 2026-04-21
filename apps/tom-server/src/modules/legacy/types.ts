import type { z } from "zod";

import type { legacyConfigSchema } from "./schema";

export type LegacyConfig = z.infer<typeof legacyConfigSchema>;
