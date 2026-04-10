import type { z } from "zod";

import type { landingConfigSchema } from "./schema";

export type LandingConfig = z.infer<typeof landingConfigSchema>["landing"];
