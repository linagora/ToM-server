import type { z } from "zod";

import type { landingSettingsSchema } from "./schema";

export type LandingConfig = z.infer<typeof landingSettingsSchema>;
